# Auditoria de Engenharia: Módulo 01 - Autenticação, Perfis e Poderes

**Data:** 24/11/2026  
**Escopo:** Login, visitante, cadastro, logout, catálogo de poderes (`can()`, `canGrant()`), sincronização em tempo real (Supabase Realtime / `permissions_epoch`), isolamento de sessão e Painel Administrativo.  
**Arquivos Auditados:**
- `src/services/adminService.ts` (3.239 linhas)
- `src/services/realtimePermissionsService.ts` (257 linhas)
- `src/context/FeatureAccessContext.tsx` (463 linhas)
- `src/components/UserProfileModal.tsx` (732 linhas)
- `src/components/AdminPanelModal.tsx` (925 linhas)
- `src/components/admin/*` (11 seções e componentes modais)
- `src/App.tsx` (seções de autenticação, simulação de perfil e eventos de sessão)

---

## 1. Achados de Auditoria (Módulo 01)

### [AUTH-01] Falha de Invalidação de Sessão Master por Fallback em Cache Local Desconectado
- **Gravidade:** Alta
- **Área:** A (Bugs e Erros) / F (Segurança)
- **Arquivo / Linha:** [src/App.tsx#L1101-L1105](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L1101-L1105) e [src/App.tsx#L1120-L1123](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L1120-L1123)
- **Descrição:** Durante o fluxo de validação da sessão (`validateAndSyncSession`), caso a consulta `supabase.auth.getUser()` falhe ou o perfil não retorne da base de dados, o código verifica se o usuário no cache do `localStorage` possuía papel `'master'` ou `'admin'`. Caso positivo, ele loga um aviso no console e **mantém a sessão Master ativa** no estado da aplicação (`return;`), sem deslogar.
- **Evidência:** 
  ```typescript
  if (!verifiedUser) {
    const cachedUser = getCurrentActiveUser();
    if (cachedUser?.role === 'master' || cachedUser?.role === 'admin') {
      console.warn('[AUTH] Falha temporária ao validar usuário Master via Supabase Auth. Mantendo sessão ativa.');
      return;
    }
    await handleLogoutRef.current('Sessão expirada');
    return;
  }
  ```
- **Impacto:** Um usuário deslogado no Supabase Auth ou com conta revogada permanece com a interface Master aberta na tela se o token falhar ou for corrompido, e um invasor que altere manualmente a chave `webgis_current_active_user` no `localStorage` pode enganar a interface para renderizar controles administrativos locais.
- **Correção Recomendada:** Tratar o `verifiedUser` do Supabase Auth como pré-requisito mandatório e inegociável para qualquer sessão autenticada. Se a validação do token falhar ou a conta for anônima, forçar encerramento imediato de qualquer privilégio de Master/Gerente, limpando tanto o estado React quanto as chaves de storage.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [AUTH-02] Vazamento de Canais Realtime por Falta de Debounce Estrito e Concorrência de Assinaturas
- **Gravidade:** Média
- **Área:** A (Bugs e Erros - Vazamento de Memória / Concorrência)
- **Arquivo / Linha:** [src/services/realtimePermissionsService.ts#L13-L28](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/services/realtimePermissionsService.ts#L13-L28) e [src/App.tsx#L873-L900](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L873-L900)
- **Descrição:** O serviço de Realtime mantém um singleton `activeChannel`, mas o `useEffect` em `App.tsx` que gerencia a assinatura depende de 5 variáveis (`[isSimulatingUser, simulatedRole, simulatedTargetUser?.id, currentActiveUser?.id, userRole]`). A cada transição de simulação ou atualização de perfil, o efeito anterior desmonta chamando `unsubscribe()` enquanto a nova chamada instancia imediatamente `supabase.channel(...)`. Como o fechamento do canal no cliente WebSocket do Supabase é assíncrono, canais intermediários continuam recebendo broadcasts e disputando o processamento do epoch com o canal ativo.
- **Evidência:** No console do navegador aparecem múltiplos logs em rajada:
  `🟢 [REALTIME] Conexão Realtime estabelecida com sucesso (webgis_perm_sync_visitor_...)` seguido de `⚡ [REALTIME] Permissões atualizadas no servidor`.
- **Impacto:** Criação de múltiplos WebSockets / canais redundantes na conexão com o Supabase, consumo desnecessário de conexões do plano do banco e disparos duplicados de `refreshPermissions()` e `fetchEffectiveCapabilitiesAsync()`.
- **Correção Recomendada:** Implementar trava de concorrência com fila atômica ou cancelamento via `AbortController` / promise de desconexão antes de abrir um novo canal, associado a um debounce de 300ms na reinicialização de canais de Realtime.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [AUTH-03] Avaliação Fallback de `can()` Inconsistente com Catálogo Remoto para Chaves Dot-Notation
- **Gravidade:** Média
- **Área:** A / E (Integração de Poderes)
- **Arquivo / Linha:** [src/context/FeatureAccessContext.tsx#L62-L152](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/context/FeatureAccessContext.tsx#L62-L152) e [src/context/FeatureAccessContext.tsx#L215-L274](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/context/FeatureAccessContext.tsx#L215-L274)
- **Descrição:** O método `normalizeCapabilityKey` mapeia strings em formato dot-notation (`admin.usuarios.bloquear`, `tool:cnefe_search`) e camelCase legado (`allowCnefeSearch`). Porém, se o usuário estiver offline ou com conexão instável e o banco de dados ainda não tiver respondido `get_effective_capabilities`, o método `can()` cai nos fallbacks locais das linhas 238-273. Nesses fallbacks, ferramentas de administração checam apenas `if (canonicalKey.startsWith('admin:')) return isMaster || isManager;`, ignorando o escopo delegado ao gerente (se o gerente tem ou não permissão concedida no catálogo para aquela ação específica).
- **Evidência:** Quando a RPC `get_effective_capabilities` falha ou demora, um gerente ganha acesso a todas as ações `admin:*` locais provisoriamente, bloqueando apenas na hora que uma chamada atinge a Edge Function ou RPC segura.
- **Correção Recomendada:** No fallback local offline para gerentes, adotar a política padrão "deny-by-default" para capacidades `admin:*` não mapeadas expressamente na lista `managerPermissions` gravada no perfil do gerente.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [AUTH-04] Duplicação de Estrutura de Permissões: Colunas JSONB Legadas em `profiles` e `webgis_user_sessions` vs. Tabelas do Catálogo
- **Gravidade:** Média
- **Área:** B (Código Legado e Morto)
- **Arquivo / Linha:** [src/services/adminService.ts#L365-L425](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/services/adminService.ts#L365-L425) e [src/types.ts#L105-L125](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/types.ts#L105-L125)
- **Descrição:** O sistema coexiste com dois modelos simultâneos de controle de acesso:
  1. O modelo legado com 4 colunas JSONB (`custom_layer_permissions`, `custom_feature_permissions`, `custom_address_columns_permissions`, `custom_feature_properties_permissions`) armazenadas dentro de `profiles` e `webgis_user_sessions`.
  2. O modelo moderno relacional com as tabelas `auth_capabilities`, `base_roles`, `role_capabilities`, `user_capabilities` e `user_delegation_scopes`.
  O `adminService.ts` possui mais de 1.200 linhas dedicadas exclusivamente a espelhar, sincronizar, fundir (*merge*) e resolver conflitos entre essas duas fontes da verdade.
- **Evidência:** No `initAdminService`, `refreshGlobalSettingsAsync` e em diversos pontos de `AdminPanelModal.tsx`, há condicionais duplas verificando tanto `featurePermissions.allowX` quanto `can('tool:x')`.
- **Impacto:** Complexidade cognitiva altíssima, payload do bundle inflado em dezenas de kilobytes de lógica defensiva e risco de dessincronização onde uma alteração feita via painel reflete em uma coluna JSON mas não na tabela relacional.
- **Correção Recomendada:** Consolidar a arquitetura elegendo o catálogo relacional (`auth_capabilities` + RPCs seguras) como única autoridade, descontinuando gradualmente o merge local de colunas JSONB e mantendo-as apenas como projeção serializada para compatibilidade.
- **Esforço:** G (Grande)
- **Risco de Regressão:** Médio

---

### [AUTH-05] Modo de Simulação Ativa Guarda de Permissões sem Bloquear Atalhos de Teclado Globais
- **Gravidade:** Baixa
- **Área:** E (Integração e UX)
- **Arquivo / Linha:** [src/App.tsx#L980-L1015](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L980-L1015)
- **Descrição:** Quando o usuário Master ativa o "Modo Simulação" (para visualizar o WebGIS como visitante ou usuário comum), o botão do Painel Master na barra lateral e no cabeçalho é devidamente ocultado. No entanto, o atalho global de teclado (ex: `Ctrl + Shift + A` ou combinações de administração) ou gatilhos acionados via console continuam chamando `handleOpenAdminLogin` / `setIsAdminModalOpen(true)` sem checar se a simulação está ativa.
- **Evidência:** Abrir simulação de visitante e pressionar o atalho de teclado administrativo ou dar duplo clique rápido no logo abre o diálogo de autenticação mesmo em modo de visualização restrita.
- **Impacto:** Quebra a fidelidade da simulação de visão do usuário final.
- **Correção Recomendada:** Inserir a checagem `if (isSimulatingUser) return;` em todos os listeners globais de atalhos administrativos em `App.tsx`.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

## 2. Status dos Fluxos de Ponta a Ponta (E2E)

| Fluxo | Papel Testado | Status | Observações |
| :--- | :--- | :---: | :--- |
| **Login com credenciais** | Usuário / Gerente / Master | Aprovado | Sessão salva no Supabase Auth e perfil mapeado |
| **Login anônimo (visitante)** | Visitante | Aprovado | Token emitido como `authenticated` com flag `is_anonymous: true` |
| **Troca de senha obrigatória** | Usuário (`must_change_password`) | Aprovado | Modal bloqueante abre ao iniciar |
| **Logout** | Qualquer papel | Aprovado | `supabase.auth.signOut({ scope: 'local' })` limpa storage |
| **Bloqueio de conta em tempo real** | Usuário ativo -> inativo | Aprovado | Realtime dispara `onAccountBlocked` e encerra sessão |
| **Delegação de poderes por gerente** | Gerente -> Subordinado | Parcial | Funciona se dentro do escopo; Edge Function falha se preflight CORS for bloqueado |
| **Exclusão de usuário no painel** | Master | Aprovado | RPC `admin_delete_user` exclui em `profiles` e `auth.users` |
