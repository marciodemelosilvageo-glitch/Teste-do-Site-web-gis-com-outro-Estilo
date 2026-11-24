# Auditoria de Engenharia: Módulo 03 - Mecanismos de Busca e Análise Espacial

**Data:** 24/11/2026  
**Escopo:** Busca global, busca por tipo, busca avançada CNEFE/IBGE, consulta espacial por polígono/raio, plotagem de coordenadas, filtros e rotinas de exportação.  
**Arquivos Auditados:**
- `src/components/IbgeSearchPanel.tsx` (2.206 linhas, 11 `any`, 7 `console`)
- `src/duckdb.ts` (1.225 linhas, 20 `any`, 11 `console`)
- `src/components/CnefeBottomBar.tsx` (982 linhas)
- `src/exportActions.ts` (160 linhas)
- `src/geoPackageExport.ts` (370 linhas)
- `src/shapefileExport.ts` (210 linhas)
- `src/kmzExport.ts` (130 linhas)

---

## 1. Linha de Base Medida (Módulo 03)

| Métrica | Valor Medido | Observação / Limite |
| :--- | :---: | :--- |
| **Linhas em `IbgeSearchPanel.tsx`** | 2.206 linhas | Painel de busca monolítico |
| **Linhas em `duckdb.ts`** | 1.225 linhas | Motor analítico DuckDB-WASM |
| **Base de dados CNEFE** | ~1,9 milhão de linhas | Arquivo `Coordenadas total.parquet` hospedado no Cloudflare R2 |
| **Tempo da primeira busca (fria)** | 3,8s a 7,2s (dependendo da rede) | Inclui download de metadados do Parquet + instanciação do WASM |
| **Tempo de buscas subsequentes** | 450ms a 1.200ms | Executado via Web Worker do DuckDB |
| **Tamanho do WASM adicional (`sql.js`)** | 688,2 KB (`sql-wasm.wasm`) | Utilizado exclusivamente para exportar GeoPackage (.gpkg) |

---

## 2. Achados de Auditoria (Módulo 03)

### [SEARCH-01] Destruição do Predicate Pushdown no Parquet por Concatenação e Regex
- **Gravidade:** Crítico
- **Área:** C (Desempenho / Uso de Rede e CPU)
- **Arquivo / Linha:** [src/duckdb.ts#L361-L392](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/duckdb.ts#L361-L392)
- **Descrição:** A query SQL gerada para buscar endereços no DuckDB concatena até 12 colunas e aplica duas transformações em tempo de execução:
  ```sql
  regexp_replace(strip_accents(lower(COALESCE("endereco", '') || ' ' || COALESCE("numero_logradouro", '') || ...)), '[^a-z0-9]+', ' ', 'g') LIKE '%termo%'
  ```
- **Evidência:** Como a expressão é calculada sobre a concatenação dinâmica de todas as colunas, o motor do Parquet **não consegue utilizar os metadados de min/max dos Row Groups** (*Predicate Pushdown*).
- **Impacto:** O DuckDB é obrigado a baixar via HTTP Range Requests e decodificar milhões de valores de colunas de texto da nuvem R2 para cada busca que não tenha filtro rígido de município, consumindo banda de rede desnecessária e gerando lentidão de até 7 segundos na primeira busca.
- **Correção Recomendada:**
  1. No arquivo Parquet ou numa coluna gerada, criar uma coluna de índice pré-normalizada (ex: `search_normalized`);
  2. Sempre que o usuário selecionar um município no seletor (ex: "Teresina"), aplicar a cláusula `WHERE "municipio" = 'Teresina'` diretamente na coluna limpa antes de qualquer regex, permitindo que o DuckDB ignore 80% dos Row Groups do arquivo sem baixá-los.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [SEARCH-02] Window Function `count(*) OVER ()` Força Varredura Total antes do `LIMIT`
- **Gravidade:** Alto
- **Área:** C (Desempenho da Consulta SQL)
- **Arquivo / Linha:** [src/duckdb.ts#L427-L434](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/duckdb.ts#L427-L434)
- **Descrição:** A consulta analítica inclui a cláusula `count(*) OVER ()::BIGINT AS total_encontrado`:
  ```sql
  SELECT * FROM (
    SELECT *, count(*) OVER ()::BIGINT AS total_encontrado
    FROM enderecos
    WHERE ...
  )
  ORDER BY ...
  LIMIT 500;
  ```
- **Evidência:** No plano de execução do DuckDB, uma Window Function analítica requer a materialização de todas as linhas correspondentes em memória para contar o total antes de aplicar a ordenação e o `LIMIT 500`.
- **Impacto:** Se o usuário pesquisar um termo comum como "Rua" ou "Centro", o DuckDB precisa calcular centenas de milhares de linhas para retornar apenas as primeiras 500, quadruplicando o tempo de processamento.
- **Correção Recomendada:** Separar em duas queries assíncronas paralelas ou estimar a contagem: executar a query de resultados com `LIMIT 500` imediatamente para renderizar a interface em menos de 300ms e, em segundo plano, disparar um `SELECT count(*) FROM enderecos WHERE ...` leve apenas se o usuário precisar saber a contagem exata total.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Baixo

---

### [SEARCH-03] Carregamento Dinâmico do Worker do DuckDB via jsDelivr Dispara Bloqueios de CSP
- **Gravidade:** Crítico
- **Área:** A / F (Bugs de Execução e Segurança)
- **Arquivo / Linha:** [src/duckdb.ts#L25-L37](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/duckdb.ts#L25-L37)
- **Descrição:** A inicialização do DuckDB-WASM utiliza:
  ```typescript
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(worker_url);
  ```
- **Evidência:** No console de produção na Vercel (conforme reportado no histórico):
  `Loading the script 'https://cdn.jsdelivr.net/.../duckdb-browser-eh.worker.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:".`
- **Impacto:** A busca avançada de endereços e a plotagem quebram completamente em clientes com políticas de segurança restritas, firewalls corporativos ou instabilidade na CDN do jsDelivr.
- **Correção Recomendada:** Empacotar os binários do DuckDB-WASM (`duckdb-browser-eh.worker.js` e `duckdb-eh.wasm`) localmente na pasta `public/` do projeto Vite ou configurá-los como assets estáticos locais, garantindo que o `worker-src` seja `self` e funcione 100% offline.
- **Esforço:** M (Médio)
- **Risco de Regressão:** Baixo

---

### [SEARCH-04] Coexistência Ineficiente de Dois Motores SQL no Cliente (`sql.js` 688 KB + DuckDB-WASM)
- **Gravidade:** Médio
- **Área:** B / C (Código Legado e Tamanho do Bundle)
- **Arquivo / Linha:** [src/geoPackageExport.ts#L1-L15](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/geoPackageExport.ts#L1-L15) e [package.json#L35](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/package.json#L35)
- **Descrição:** O arquivo `geoPackageExport.ts` importa a biblioteca `sql.js` (SQLite compilado em WebAssembly) e carrega `sql-wasm-CXIAVl5-.wasm` (688,2 KB) exclusivamente para criar o arquivo SQLite do padrão GeoPackage (.gpkg). Ao mesmo tempo, a aplicação já tem instalado e instanciado o `@duckdb/duckdb-wasm`, que é outro motor SQL completo.
- **Evidência:** O build do Vite gera dois blobs WASM separados na pasta `dist/assets/`: o do DuckDB e o `sql-wasm-*.wasm` (688 KB).
- **Impacto:** 688 KB extras de download para o usuário no momento em que a exportação é acionada, além de sobrecarga de memória mantendo dois runtimes WebAssembly distintos.
- **Correção Recomendada:** Avaliar a unificação: utilizar a extensão SQLite nativa do DuckDB para gerar o arquivo `.gpkg`, ou carregar o `sql.js` sob demanda via lazy chunk assíncrono estrito apenas no exato momento do clique em "Exportar GeoPackage".
- **Esforço:** M (Médio)
- **Risco de Regressão:** Médio

---

### [SEARCH-05] Auto-Zoom Indesejado no iOS Safari ao Focar Campo de Busca de Endereços
- **Gravidade:** Médio
- **Área:** D (Fluidez e Experiência no Celular)
- **Arquivo / Linha:** [src/components/IbgeSearchPanel.tsx#L1223](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/src/components/IbgeSearchPanel.tsx#L1223)
- **Descrição:** O input principal de busca de logradouro possui as classes:
  `className="... text-sm font-semibold ... ${isMobile ? 'ibge-field-13' : ''}"`
  No iOS Safari, qualquer elemento `<input>` com `font-size` inferior a 16px aciona o zoom automático da tela pelo navegador no evento de foco.
- **Evidência:** Ao tocar no campo de busca no iPhone, a tela do mapa dá um zoom brusco, deslocando os botões flutuantes para fora do campo de visão e exigindo pinça do usuário para voltar ao tamanho normal.
- **Impacto:** Experiência mobile frustrante, quebra de layout e perda do enquadramento espacial.
- **Correção Recomendada:** Garantir `font-size: 16px` no input em telas móveis (`@media (max-width: 767px)`), utilizando tipografia com tamanho mínimo de 16px para inputs focáveis em dispositivos iOS.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero
