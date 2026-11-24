# Auditoria de Engenharia: Módulo 06 - Qualidade, Tipagem e Arquitetura de Software

**Data:** 24/11/2026  
**Escopo:** Estrutura do projeto, tipagem TypeScript, regras de linter, testes automatizados, CI/CD, dependências mortas e plano de decomposição dos arquivos gigantes.  
**Arquivos Auditados:**
- `tsconfig.json` (36 linhas)
- `eslint.config.js` (24 linhas)
- `package.json` (60 linhas)
- `vite.config.ts` (34 linhas)
- Arquivos gigantes: `MapComponent.tsx` (5.181L), `App.tsx` (4.599L), `adminService.ts` (3.239L), `AppleSidebar.tsx` (2.825L), `IbgeSearchPanel.tsx` (2.206L).

---

## 1. Linha de Base Medida (Módulo 06)

| Métrica | Valor Medido | Observação / Meta |
| :--- | :---: | :--- |
| **Total de arquivos no `src/`** | 65 arquivos | 38.947 linhas no total |
| **Linhas nos 5 maiores arquivos** | 18.050 linhas | Quase 50% de todo o código em apenas 5 arquivos |
| **Ocorrências do tipo `any`** | 394 ocorrências | 142 no MapComponent, 69 no App, 42 no adminService |
| **Total de chamadas `console.*`** | 115 chamadas | 60 errors, 44 warns, 9 infos, 2 debugs |
| **Modo Strict no TypeScript** | Desativado (`"strict": false`) | `"strict": true` não configurado em `tsconfig.json` |
| **Cobertura de testes automatizados** | 0% | Nenhum teste unitário ou E2E (apenas scripts manuais) |
| **Dependências mortas no bundle** | `axios` | Instalado em `dependencies`, sem nenhum `import` no projeto |

---

## 2. Achados de Auditoria (Módulo 06)

### [ENG-01] Arquivos Monolíticos Gigantescos com Alto Acoplamento
- **Gravidade:** Crítico
- **Área:** G (Qualidade e Manutenibilidade)
- **Arquivo / Linha:** [src/components/MapComponent.tsx](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx) (5.181L), [src/App.tsx](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx) (4.599L) e [src/services/adminService.ts](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/services/adminService.ts) (3.239L)
- **Descrição:** O projeto concentra a quase totalidade de sua lógica de interface, controle de estado e manipulação espacial em 3 arquivos com mais de 3.000 a 5.000 linhas cada.
- **Evidência:** 
  - `MapComponent.tsx` mistura ciclo de vida do Leaflet, controle de medição, popups, tooltips, dissolução turf, painel flutuante, escuta de redimensionamento e exportação de feições.
  - `App.tsx` gerencia 70 hooks de `useState` no mesmo componente raiz, acumulando controle de autenticação, simulação de perfil, temas, atalhos de teclado, coordenação de busca, impressão A4 e roteamento mobile/desktop.
- **Impacto:** Altíssimo risco de efeitos colaterais em qualquer alteração, lentidão no autocomplete do editor de código, dificuldade de revisão de PRs e impossibilidade de aplicar testes unitários isolados.
- **Correção Recomendada (Plano de Decomposição Modular):**
  1. **Decomposição do `MapComponent.tsx`**:
     - `src/components/map/useLeafletInstance.ts`: Inicialização, remoção e canvas do Leaflet;
     - `src/components/map/useMeasureTool.ts`: Lógica da ferramenta de medição e cálculo de áreas;
     - `src/components/map/useVectorLayers.ts`: Carregamento de GeoJSONs, estilização dinâmica e popups;
     - `src/components/map/useDissolveTool.ts`: Lógica Turf.js de união e dissolução de geometrias;
     - `src/components/map/MapFloatingControls.tsx`: Controles visuais flutuantes (zoom, camada base, tela cheia).
  2. **Decomposição do `App.tsx`**:
     - `src/context/AuthContext.tsx`: Extração dos 15 estados de login, perfis e troca de senha;
     - `src/context/PrintModeContext.tsx`: Extração dos estados e modais de impressão A4;
     - `src/context/CnefeSearchStateContext.tsx`: Extração dos estados de busca CNEFE e coordenadas;
     - Manter o `App.tsx` apenas como orquestrador de alto nível com menos de 400 linhas.
  3. **Decomposição do `adminService.ts`**:
     - `src/services/admin/userManagementService.ts`: CRUD de usuários, troca de senha e bloqueios;
     - `src/services/admin/capabilitiesService.ts`: Resolução de capacidades e poderes relacionais;
     - `src/services/admin/auditLogService.ts`: Telemetria e gravação de logs de auditoria;
     - `src/services/admin/settingsService.ts`: Configurações globais e sincronização com banco.
- **Esforço:** G (Grande)
- **Risco de Regressão:** Alto (deve ser executado em etapas incrementais com testes)

---

### [ENG-02] TypeScript Leniente sem `"strict": true` e 394 Usos de `any`
- **Gravidade:** Alto
- **Área:** G (Qualidade e Segurança de Tipos)
- **Arquivo / Linha:** [tsconfig.json#L2-L25](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/tsconfig.json#L2-L25)
- **Descrição:** O compilador TypeScript está configurado sem as diretivas essenciais de segurança de tipos:
  `"strict": true`, `"strictNullChecks": true` e `"noImplicitAny": true` estão ausentes.
- **Evidência:** Há 394 ocorrências explícitas do tipo `any` em caminhos críticos de negócio (manipulação de feições espaciais, dados de sessão, retorno de queries SQL do DuckDB e eventos do Leaflet).
- **Impacto:** Propriedades inexistentes ou nulas passam despercebidas pelo build e geram erros fatais em runtime do tipo `TypeError: Cannot read properties of undefined (reading '...')` no navegador do usuário final.
- **Correção Recomendada:** Ativar `"strictNullChecks": true` gradualmente e substituir tipos `any` por interfaces concretas (`GeoJSON.Feature`, `L.LeafletMouseEvent`, `DuckDBRow`, `UserProfile`).
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [ENG-03] ESLint Desprovido de Regras Recomendadas e Acessibilidade (jsx-a11y)
- **Gravidade:** Médio
- **Área:** G (Governança de Código)
- **Arquivo / Linha:** [eslint.config.js#L1-L24](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/eslint.config.js#L1-L24)
- **Descrição:** A configuração do ESLint possui apenas 2 regras ativas (`react-hooks/rules-of-hooks` e `react-hooks/exhaustive-deps`). As recomendações padrão do TypeScript, do React e de Acessibilidade (`eslint-plugin-jsx-a11y`) estão totalmente desativadas.
- **Evidência:** Variáveis mortas não são alertadas, tags sem rótulo acessível passam no build e problemas de tipagem não são reportados pelo linter.
- **Impacto:** Acúmulo silencioso de dívida técnica e barreiras de acessibilidade para usuários com deficiência ou navegação por teclado.
- **Correção Recomendada:** Expandir o `eslint.config.js` com `@eslint/js.configs.recommended`, `tseslint.configs.recommended` e regras básicas de acessibilidade de botões e links.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [ENG-04] Ausência de Pipeline de Integração Contínua (CI) com Testes Automatizados
- **Gravidade:** Alto
- **Área:** G (Qualidade e Confiabilidade)
- **Arquivo / Linha:** [.github/workflows/](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/.github/workflows/)
- **Descrição:** O repositório possui apenas a action do Gitleaks configurada. Não existe nenhuma esteira de CI que valide `tsc --noEmit`, `npm run lint` ou testes unitários antes da aprovação de commits ou pull requests.
- **Evidência:** Mudanças com erros de sintaxe ou quebras de tipos podem ser enviadas diretamente para a branch `main` e disparar deploys quebrados na Vercel.
- **Impacto:** Falta de barreira protetora contra regressões em produção.
- **Correção Recomendada:** Criar um workflow do GitHub Actions (`.github/workflows/ci.yml`) que execute:
  1. `npm ci`
  2. `npm run lint`
  3. `npm run build`
  4. Execução de testes automatizados com Vitest.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [ENG-05] Dependência Morta (`axios`) e Pacotes de Servidor em `dependencies`
- **Gravidade:** Baixo
- **Área:** B (Código Legado e Limpeza de Dependências)
- **Arquivo / Linha:** [package.json#L22-L28](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/package.json#L22-L28)
- **Descrição:**
  1. O pacote `axios` está instalado no projeto mas **não é importado em nenhum arquivo** de `src/` nem de `server.ts`. Todas as requisições HTTP do sistema utilizam a API nativa `fetch`.
  2. Os pacotes `express`, `cors`, `http-proxy-middleware` e `dotenv` estão listados na seção `"dependencies"` de produção, embora sejam utilizados unicamente no script de desenvolvimento local `server.ts`. O deploy em produção na Vercel é 100% estático (SPA gerenciado pelo Vite).
- **Evidência:** Varredura em todos os arquivos de código-fonte confirma zero ocorrências de `import ... from 'axios'`.
- **Impacto:** Instalações mais lentas no `npm install`, aumento desnecessário do `node_modules` e vulnerabilidades potenciais em pacotes sem uso.
- **Correção Recomendada:** Remover `axios` do `package.json` e mover `express`, `cors`, `http-proxy-middleware` e `dotenv` para `"devDependencies"`.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero
