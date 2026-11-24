# Auditoria de Engenharia: Módulo 05 - Dados e Infraestrutura

**Data:** 24/11/2026  
**Escopo:** DuckDB-WASM, Cloudflare R2 (Parquet de 1,9M de linhas), Supabase (Auth, RLS, Realtime, Edge Functions), `server.ts` (Express dev proxy), `vercel.json` (Deploy Vercel, CSP, headers), variáveis de ambiente e assets estáticos pesados.  
**Arquivos Auditados:**
- `src/duckdb.ts` (1.225 linhas)
- `src/supabaseClient.ts` (18 linhas)
- `server.ts` (195 linhas)
- `vercel.json` (34 linhas)
- `supabase/functions/admin-users/index.ts` (586 linhas)
- `public/favicon.svg` (301,8 KB)
- `public/ne_110m_land.json` (237,4 KB)
- `src/components/Globe.tsx` (565,6 KB bundle chunk)

---

## 1. Linha de Base Medida (Módulo 05)

| Métrica | Valor Medido | Observação / Limite |
| :--- | :---: | :--- |
| **Favicon (`public/favicon.svg`)** | 301.776 bytes (301,8 KB) | Favicon com PNG em base64 embutido; deveria ser < 5 KB |
| **GeoJSON do Globo (`ne_110m_land.json`)** | 237.355 bytes (237,4 KB) | Carregado apenas quando o modal 3D é aberto |
| **Chunk do Globo (`Globe.js`)** | 565.589 bytes (565,6 KB) | Three.js + renderizador 3D esférico |
| **Chunk do DuckDB (`vendor-duckdb.js`)** | 192.922 bytes (192,9 KB) | Rótulo do cliente DuckDB-WASM |
| **Arquivo WASM SQLite (`sql-wasm.wasm`)** | 688.197 bytes (688,2 KB) | SQLite WASM para exportação GeoPackage |
| **Servidor Local (`server.ts`)** | Express + Vite SSR Proxy | Somente para desenvolvimento local |

---

## 2. Achados de Auditoria (Módulo 05)

### [INFRA-01] Bloqueio de CORS na Edge Function `admin-users` no Preflight OPTIONS
- **Gravidade:** Crítico
- **Área:** A / E (Bugs de Conectividade e Execução)
- **Arquivo / Linha:** [supabase/functions/admin-users/index.ts#L7-L20](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/supabase/functions/admin-users/index.ts#L7-L20)
- **Descrição:** Ao tentar criar ou gerenciar usuários pelo painel na Vercel (`https://teste-do-site-web-gis-com-outro-est.vercel.app`), o console acusa:
  `Access to fetch at 'https://qsstrhxeesbvfnxuiibj.supabase.co/functions/v1/admin-users' from origin '...' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`
- **Evidência:** Se a Edge Function do Supabase for configurada no gateway com verificação de JWT obrigatória ativa (*Enforce JWT verification*), o Kong API Gateway do Supabase intercepta o preflight HTTP `OPTIONS` antes de alcançar o script `index.ts` em Deno. Como a requisição preflight não envia o token de autenticação, o gateway retorna status 401 Unauthorized, falhando o preflight CORS do navegador.
- **Impacto:** O Master e os gerentes ficam impedidos de cadastrar, alterar ou excluir usuários a partir da aplicação em produção na Vercel.
- **Correção Recomendada:**
  1. Desativar a verificação automática de JWT no gateway do Supabase para esta função (`supabase functions deploy admin-users --no-verify-jwt`), já que a validação de identidade é feita manualmente nas linhas 34-45 do código (`supabaseCaller.auth.getUser()`);
  2. Assegurar que os cabeçalhos `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` e `Access-Control-Allow-Headers` respondam status 200/204 para métodos `OPTIONS` sem exigir token.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [INFRA-02] Favicon com Imagem Rasterizada Embutida Pesa 301,8 KB
- **Gravidade:** Médio
- **Área:** C (Desempenho e Carregamento Inicial)
- **Arquivo / Linha:** [public/favicon.svg](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/public/favicon.svg)
- **Descrição:** O arquivo `public/favicon.svg` mede 301.776 bytes (quase um terço de megabyte). Ao inspecionar o arquivo, descobre-se que ele não é um vetor SVG puro, mas uma tag `<image href="data:image/png;base64,..."/>` contendo um PNG bitmap gigantesco codificado em base64.
- **Evidência:** Primeira requisição de carregamento da página baixa 301 KB apenas para o ícone da aba do navegador.
- **Impacto:** Desperdiça largura de banda móvel e atrasa a conclusão do carregamento inicial da página (First Contentful Paint / LCP).
- **Correção Recomendada:** Substituir o favicon por um SVG vetorial real desenhado com caminhos (`<path>`) otimizados ou gerar um `.ico` / `.svg` limpo com menos de 3 KB (redução de 99% no peso do favicon).
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [INFRA-03] Falta de Regra de Rewrites SPA em `vercel.json`
- **Gravidade:** Médio
- **Área:** A / E (Disponibilidade e Roteamento)
- **Arquivo / Linha:** [vercel.json#L1-L34](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/vercel.json#L1-L34)
- **Descrição:** O arquivo `vercel.json` configura estritamente cabeçalhos de segurança (CSP, HSTS, X-Frame-Options), mas **não possui** a seção `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`.
- **Evidência:** Caso o usuário acesse uma URL com caminho profundo ou caso a aplicação venha a utilizar rotas de URL no futuro (ex: `go_router` ou `react-router`), a Vercel retornará página de erro 404 estática em vez de carregar o `index.html`.
- **Impacto:** Risco de páginas quebradas caso links diretos ou parâmetros de sub-rotas sejam acessados no navegador.
- **Correção Recomendada:** Adicionar a regra padrão de reescrita SPA no `vercel.json`.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero

---

### [INFRA-04] Risco de Vazamento de Segredos e Chaves de Variáveis de Ambiente
- **Gravidade:** Baixo (Preventivo)
- **Área:** F (Segurança de Infraestrutura)
- **Arquivo / Linha:** [.env](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/.env) e [.gitignore](file:///c:/Users/DINT-SSPPI/.gemini/antigravity-ide/scratch/Teste-do-Site-web-gis-com-outro-Estilo/.gitignore)
- **Descrição:** O arquivo `.env` local contém as chaves públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O arquivo `.gitignore` protege os arquivos `.env*`, mas o arquivo `vite.config.ts` possui:
  `envPrefix: ['VITE_', 'site_', 'suba_']`.
- **Evidência:** Qualquer variável de ambiente no servidor que comece com `site_` ou `suba_` será injetada no bundle público compilado do Vite.
- **Impacto:** Se um desenvolvedor criar uma chave `suba_service_role` ou `site_admin_secret`, ela será exposta publicamente no código JavaScript final.
- **Correção Recomendada:** Restringir o `envPrefix` exclusivamente para `['VITE_']`, mantendo o padrão seguro da indústria.
- **Esforço:** P (Pequeno)
- **Risco de Regressão:** Zero
