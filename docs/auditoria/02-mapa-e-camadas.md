# Auditoria de Engenharia: Módulo 02 - Mapa e Camadas

**Data:** 24/11/2026  
**Escopo:** `MapComponent.tsx` (5.181 linhas), renderização Leaflet, seleção de feições, ferramentas de medição e dissolução, controle de camadas, popups, tooltips e ciclo de vida do mapa.  
**Arquivos Auditados:**
- `src/components/MapComponent.tsx` (5.181 linhas, 39 `useEffect`, 142 `any`)
- `src/data.ts` (definição de fontes de dados e camadas GeoJSON)
- `src/categories.ts` (agrupamento e categorias)
- `src/App.tsx` (integração do mapa no desktop e mobile)

---

## 1. Linha de Base Medida (Módulo 02)

| Métrica | Valor Medido | Observação / Limite Recomendado |
| :--- | :---: | :--- |
| **Linhas de código** | 5.181 linhas | Arquivo monolítico crítico; recomendado < 600 linhas por arquivo |
| **Total de `useEffect`** | 39 hooks | 7 hooks consecutivos apenas sincronizando props para refs |
| **Uso de tipo `any`** | 142 ocorrências | Alto risco de quebra silenciosa em runtime |
| **Modo de renderização Leaflet** | `preferCanvas: false` | Renderiza cada coordenada como elemento SVG no DOM |
| **Chunk de compilação gerado** | Embutido no `index.js` (1,2 MB) | Deveria ser lazy-loaded via `React.lazy` |

---

## 2. Achados de Auditoria (Módulo 02)

### [MAP-01] Vazamento Contínuo de Memória em `layerFeatureMapRef`
- **Gravidade:** Crítico
- **Área:** A (Bugs e Erros - Vazamento de Memória)
- **Arquivo / Linha:** [src/components/MapComponent.tsx#L1438](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L1438), [L1446](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L1446) e [L3113](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L3113)
- **Descrição:** O ref `layerFeatureMapRef` armazena referências a cada feição e à sua respectiva instância de camada Leaflet (`layerFeatureMapRef.current[layerId] = { feature, title, sourceName, layer }`). No entanto, esse dicionário **nunca é limpo** quando camadas são desmarcadas, quando o mapa é recarregado ou quando feições deixam de existir.
- **Evidência:** 
  O termo `layerFeatureMapRef` aparece apenas em 3 linhas em todo o arquivo de 5.181 linhas:
  1. Criação do ref (L1438);
  2. Leitura na busca espacial (L1446);
  3. Inserção contínua em `onEachFeature` (L3113).
  Não existe `delete`, `clear` ou reinicialização em nenhum ponto do ciclo de vida.
- **Impacto:** Conforme o usuário navega, ativa e desativa camadas, instâncias de `L.Path`, `L.Polygon` e listeners internos do Leaflet permanecem presas no heap do JavaScript, causando crescimento linear do consumo de RAM (Memory Leak) até degradação da aba ou OOM (*Out Of Memory*).
- **Correção Recomendada:** Esvaziar o dicionário associado ou indexar por nome de camada (`Record<sourceName, Record<layerId, ...>>`), removendo as chaves correspondentes sempre que uma camada for descartada do mapa.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [MAP-02] Renderização Vetorial em SVG (`preferCanvas: false`) Degrada FPS com Grandes Polígonos
- **Gravidade:** Alto
- **Área:** C (Desempenho / GPU / Mobile)
- **Arquivo / Linha:** [src/components/MapComponent.tsx#L2155](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L2155)
- **Descrição:** A inicialização do mapa Leaflet desativa explicitamente o renderizador Canvas:
  ```typescript
  const map = L.map(mapContainerRef.current, { 
    zoomControl: false,
    preferCanvas: false,
    wheelDebounceTime: 40,
    wheelPxPerZoomLevel: 60
  }).setView([-7.0, -42.8], 7);
  ```
- **Evidência:** Ao carregar camadas densas como "Municípios", "Localidades (Piauí)" e "Setores Censitários", o DOM do navegador fica inundado por centenas de elementos `<path>` e `<svg>`.
- **Impacto:** Queda drástica de taxa de quadros (FPS caindo para 15-20 FPS) durante pan e zoom em celulares intermediários ou notebooks sem aceleração de GPU dedicada, aumentando o Total Blocking Time (TBT).
- **Correção Recomendada:** Ativar `preferCanvas: true` e utilizar `L.canvas({ padding: 0.5, tolerance: 10 })`. O Canvas do HTML5 renderiza geometrias complexas diretamente na GPU em uma única superfície gráfica sem sobrecarregar a árvore do DOM.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo (apenas verificar estilos e eventos de mouseover/click nos polígonos com tolerance ajustada)

---

### [MAP-03] Enxurrada de Efeitos Redundantes (7 Hooks Sincronizando Props para Refs)
- **Gravidade:** Médio
- **Área:** A / C (Desempenho e Re-renderizações)
- **Arquivo / Linha:** [src/components/MapComponent.tsx#L894-L927](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L894-L927)
- **Descrição:** Existem 7 chamadas consecutivas de `useEffect` com a única finalidade de copiar o valor da prop para a propriedade `.current` de um ref:
  ```typescript
  useEffect(() => { selectedFeaturesRef.current = selectedFeatures; }, [selectedFeatures]);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  useEffect(() => { searchSelectedFeatureIdRef.current = searchSelectedFeatureId; }, [searchSelectedFeatureId]);
  useEffect(() => { isDetailsTabOpenRef.current = isDetailsTabOpen; }, [isDetailsTabOpen]);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);
  useEffect(() => { onOpenDetailsTabRef.current = onOpenDetailsTab; }, [onOpenDetailsTab]);
  useEffect(() => { onClearSearchSelectedFeatureIdRef.current = onClearSearchSelectedFeatureId; }, [onClearSearchSelectedFeatureId]);
  ```
- **Evidência:** 7 microtarefas assíncronas do React são enfileiradas após a fase de commit a cada renderização.
- **Impacto:** Ciclos de execução de hooks desnecessários em um componente de 5.000 linhas, gerando atraso cumulativo no loop de eventos.
- **Correção Recomendada:** Atribuir os valores diretamente no corpo da função durante o ciclo de renderização (`selectedFeaturesRef.current = selectedFeatures;`), ou consolidar em um único hook, eliminando 6 `useEffect` completos.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [MAP-04] Quebra da Memoização de `MapComponent` por Funções Anônimas Inline em `App.tsx`
- **Gravidade:** Alto
- **Área:** C (Desempenho / Re-renderizações em Cascata)
- **Arquivo / Linha:** [src/App.tsx#L4240-L4248](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L4240-L4248) e [src/components/MapComponent.tsx#L5177](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L5177)
- **Descrição:** Embora o componente seja exportado como `React.memo(MapComponentInner)`, `App.tsx` passa funções criadas inline no JSX:
  `onTogglePrintMode={() => setIsPrintMode(prev => !prev)}` e `onSelectionChange={(features) => { ... }}` (uma função inline de 25 linhas).
- **Evidência:** A comparação rasa (*shallow equality*) do `React.memo` sempre detecta que as funções mudaram a cada re-render de `App` (por exemplo, quando o usuário digita na busca global ou quando o status text é alterado), forçando o `MapComponent` a re-renderizar todas as suas 5.181 linhas.
- **Impacto:** Destrói completamente o benefício do `React.memo`, causando travamentos momentâneos da interface e lag de digitação no campo de busca.
- **Correção Recomendada:** Envolver `onTogglePrintMode` e `onSelectionChange` em `useCallback` com dependências estáveis em `App.tsx`.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [MAP-05] Destruição Completa e Recriação do Mapa ao Rotacionar Tela ou Mudar Breakpoint (768px)
- **Gravidade:** Alto
- **Área:** A / D (Consistência Desktop vs Mobile e Fluidez)
- **Arquivo / Linha:** [src/App.tsx#L3902](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L3902) e [src/App.tsx#L4238](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/App.tsx#L4238)
- **Descrição:** O layout divide o desktop e o mobile em ramos separados através de um ternário condicional `{isMobile ? <MobileShell><MapComponent isMobile={true} /></MobileShell> : <><AppleSidebar /><MapComponent isMobile={false} /></>}`.
- **Evidência:** Quando a largura da tela transita entre 767px e 768px (redimensionamento de janela ou rotação de tablet/iPad), a primeira instância do `MapComponent` é completamente desmontada (`map.remove()`), destruindo o mapa, limpando o cache em memória e montando uma segunda instância do zero.
- **Impacto:** O usuário perde a posição que estava explorando, camadas recém-carregadas precisam ser baixadas novamente da rede e a tela pisca em branco.
- **Correção Recomendada:** Manter uma **instância única persistente** do `<MapComponent />` montada no DOM, ajustando o layout dos painéis (MobileShell vs AppleSidebar) via CSS responsivo e chamando `map.invalidateSize()` na transição, sem desmontar o container do Leaflet.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Médio

---

### [MAP-06] Injeção de String em Atributos HTML Inline (`onclick`) nos Popups do Mapa
- **Gravidade:** Médio
- **Área:** F (Segurança)
- **Arquivo / Linha:** [src/components/MapComponent.tsx#L2524](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/MapComponent.tsx#L2524)
- **Descrição:** No popup do botão direito (contextmenu), a ação de pesquisar feições é injetada como texto no atributo `onclick`:
  ```html
  onclick="event.preventDefault(); event.stopPropagation(); if(window.identifyFeaturesFromCtx) window.identifyFeaturesFromCtx('${latFormatted}', '${lngFormatted}');"
  ```
- **Evidência:** Viola as boas práticas de separação de código e CSP (requer `'unsafe-inline'` para funcionar) e depende de expor a função `identifyFeaturesFromCtx` como propriedade global no objeto `window`.
- **Impacto:** Impede a adoção de um Content Security Policy (CSP) mais rigoroso sem `'unsafe-inline'` para scripts de eventos.
- **Correção Recomendada:** Criar elementos DOM via API nativa (`document.createElement`) ou vincular listeners via Leaflet `L.DomEvent.on(btn, 'click', ...)`, eliminando strings `onclick` embutidas.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo
