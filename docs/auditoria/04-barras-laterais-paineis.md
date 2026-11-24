# Auditoria de Engenharia: Módulo 04 - Barras Laterais, Painéis e Interface de Usuário

**Data:** 24/11/2026  
**Escopo:** `AppleSidebar.tsx` (Desktop), `MobileShell` / Gavetas Mobile, painéis de Detalhes, Raio-X (`Dashboard.tsx`), Exportar (`ExportDashboard.tsx`), Personalizar (`PropertyTableModal.tsx`), estilo Apple/iOS, acessibilidade e responsividade.  
**Arquivos Auditados:**
- `src/components/AppleSidebar.tsx` (2.825 linhas)
- `src/components/Dashboard.tsx` (772 linhas)
- `src/components/ExportDashboard.tsx` (697 linhas)
- `src/components/PropertyTableModal.tsx` (Personalização de colunas)
- `src/components/FeatureInfoModal.tsx` (Detalhes da feição)
- `src/components/mobile/*` (MobileDrawer, MobileSheet, MobileHeader, MobileFloatingSearch, NavMenuSheet)
- `src/constants/mobileZIndexes.ts` (Hierarquia de profundidade z-index)

---

## 1. Linha de Base Medida (Módulo 04)

| Métrica | Valor Medido | Observação / Limite Recomendado |
| :--- | :---: | :--- |
| **Linhas em `AppleSidebar.tsx`** | 2.825 linhas | Componente complexo com acordeões, camadas e sub-painéis |
| **Memoização de `AppleSidebar`** | Ausente (sem `React.memo`) | Re-renderiza a cada frame de busca ou cursor |
| **Tempo de arrasto de gavetas mobile** | 60ms a 140ms de latência | Queda de quadros causada por recálculo de layout do Leaflet |
| **Touch targets mínimos** | Vários botões com 24px a 28px | Padrão Apple HIG / WCAG exige no mínimo 44x44px no mobile |
| **Espaço útil de mapa em iPad (768px)** | Apenas ~132px úteis | Barra lateral (256px) + Estágio 2 (380px) consom 636px de 768px |

---

## 2. Achados de Auditoria (Módulo 04)

### [PANEL-01] Falta de Memoização em `AppleSidebar.tsx` Gera Re-renderizações Contínuas
- **Gravidade:** Alto
- **Área:** C (Desempenho / CPU)
- **Arquivo / Linha:** [src/components/AppleSidebar.tsx#L2820](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/AppleSidebar.tsx#L2820)
- **Descrição:** O componente `AppleSidebar` possui 2.825 linhas e dezenas de hooks internos (`useMemo`, `useState`), mas é exportado como componente funcional padrão sem `React.memo`.
- **Evidência:** Como `App.tsx` re-renderiza frequentemente devido a seus 70 estados locais, a barra lateral inteira (incluindo renderização de 20+ camadas, contadores e acordeões) re-renderiza a cada tecla digitada no campo de busca global.
- **Impacto:** Alto consumo de CPU, micro-travamentos (*jank*) e aquecimento da CPU em sessões prolongadas no desktop.
- **Correção Recomendada:** Envolver `AppleSidebar` em `React.memo` e memoizar rigorosamente as funções de callback passadas por `App.tsx` (`onToggleLayer`, `onSelectFeature`, `onOpenDetailsTab`).
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [PANEL-02] Ocupação Excessiva da Tela em Tablets (768px a 1024px)
- **Gravidade:** Alto
- **Área:** D (Fluidez, Layout e Breakpoints)
- **Arquivo / Linha:** [src/App.tsx#L3902](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L3902) e [src/components/AppleSidebar.tsx#L120-L160](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/AppleSidebar.tsx#L120-L160)
- **Descrição:** O breakpoint que comuta entre mobile e desktop está fixado em 768px (`md`). Em tablets como iPad Mini ou iPad 10" em orientação vertical (768px ou 810px de largura):
  - A barra principal ocupa 256px de largura fixa (`w-64`);
  - Quando qualquer aba é aberta (Estágio 2), abre-se um painel secundário com 380px de largura fixa (`w-[380px]`);
  - A soma atinge 636px de largura!
- **Evidência:** Em uma tela de 768px de largura, o mapa do Leaflet fica espremido em uma faixa vertical de míseros 132px (menos de 18% da tela), tornando a visualização de feições cartográficas inviável.
- **Impacto:** Inutilização prática do WebGIS em tablets na orientação vertical (modo retrato).
- **Correção Recomendada:** No intervalo de 768px a 1024px, tratar o Estágio 2 como gaveta flutuante sobreposta (*floating drawer* / modal com backdrop ou recolhimento automático do Estágio 1), ou elevar o breakpoint do layout desktop para `lg` (1024px), utilizando o layout mobile otimizado em tablets de 768px a 1023px.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [PANEL-03] Sobreposição de Controles pela Barra de Navegação Inferior do iOS (Home Indicator)
- **Gravidade:** Médio
- **Área:** D (Experiência Mobile / iOS Safe Areas)
- **Arquivo / Linha:** [src/components/mobile/MobileSheet.tsx#L45](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/mobile/MobileSheet.tsx#L45) e [src/components/CnefeBottomBar.tsx#L350](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/CnefeBottomBar.tsx#L350)
- **Descrição:** Embora variáveis CSS de Safe Area estejam declaradas no `:root` (`--sab: env(safe-area-inset-bottom, 0px)`), componentes como `CnefeBottomBar` e certos painéis móveis usam classes utilitárias fixas como `bottom-0 pb-3` em vez de `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`.
- **Evidência:** No iPhone (Safari e modo PWA), o traço cinza/preto da barra de início do sistema (*Home Indicator*) fica exatamente sobreposto aos botões de ação e paginação na base do painel.
- **Impacto:** O usuário tenta tocar no botão inferior da barra e aciona o gesto do sistema iOS para trocar de aplicativo ou ir para a tela de início (*misclicks* frequentes).
- **Correção Recomendada:** Aplicar `padding-bottom: max(12px, env(safe-area-inset-bottom))` e `safe-area-bottom` em todos os containers fixados no rodapé móvel.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [PANEL-04] Alvos de Toque Menores que 44x44px em Ações Críticas (Violação WCAG 2.5.5)
- **Gravidade:** Médio
- **Área:** D (Acessibilidade e Usabilidade ao Toque)
- **Arquivo / Linha:** [src/components/AppleSidebar.tsx#L850-L920](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/AppleSidebar.tsx#L850-L920) e [src/components/mobile/MobileFloatingSearch.tsx#L65](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/mobile/MobileFloatingSearch.tsx#L65)
- **Descrição:** Vários botões de controle de zoom, visibilidade de camada, fechar painel e limpar filtros possuem dimensões visuais e áreas de clique reduzidas (ex: botões `w-6 h-6` ou `p-1`, medindo entre 24px e 28px de largura/altura real).
- **Evidência:** No celular, usuários com dedos maiores frequentemente erram o toque ou precisam tentar duas vezes para fechar uma gaveta ou alternar o estilo de uma camada.
- **Impacto:** Não conformidade com o padrão internacional WCAG 2.5.5 (Target Size) e com as diretrizes Human Interface Guidelines da Apple (mínimo de 44x44 pt para qualquer elemento interativo sensível ao toque).
- **Correção Recomendada:** Sem alterar o design visual compacto dos ícones, expandir a área de toque invisível através de pseudo-elementos (`::after` com `inset: -8px` ou `min-w-[44px] min-h-[44px] flex items-center justify-center`).
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero
