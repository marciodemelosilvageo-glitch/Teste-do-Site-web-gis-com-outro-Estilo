<div align="center">

# 🌍 WebGIS — Gerência de Dados & Cartografia

[![React](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![DuckDB](https://img.shields.io/badge/DuckDB--WASM-1.33-fff000?style=for-the-badge&logo=duckdb&logoColor=black)](https://duckdb.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

<p align="center">
  <strong>Plataforma Geoespacial Integrada para Visualização Territorial, Consulta do CNEFE (IBGE) e Análise Espacial</strong>
</p>

</div>

---

## 📌 Sobre o Projeto

O **WebGIS** é uma solução geoespacial de alta performance desenvolvida para permitir a exploração interativa, consulta e análise de dados censitários e territoriais do estado do Piauí e municípios integrados. 

O sistema combina dados do **IBGE**, **SSP-PI** e bases cartográficas estaduais, oferecendo consulta a **milhões de endereços do CNEFE** em tempo real no próprio navegador via WebAssembly (**DuckDB-WASM**), sem sobrecarregar servidores.

---

## ✨ Principais Funcionalidades

### 🗺️ 1. Mapeamento e Camadas Geoespaciais
* **Visualização Dinâmica de Camadas**: Municípios, Bairros, Favelas e Comunidades Urbanas, Núcleos Urbanos, Aglomerados Rurais, Áreas de Desenvolvimento, AISP, RISP e Localidades/Povoados.
* **Estilização e Opacidade Personalizáveis**: Controle de cores, preenchimento e visibilidade individual de cada camada.
* **Ferramentas de Medição**: Cálculo preciso de distâncias e áreas em metros quadrados ou hectares no mapa.

### 🔍 2. Busca e Geocodificação CNEFE (IBGE)
* **Motor DuckDB-WASM Local**: Processamento ultrarrápido de queries SQL analíticas diretamente no navegador a partir de arquivos `.parquet` na nuvem (Cloudflare R2 via HTTP Range Requests).
* **Busca Inteligente**: Pesquisa por logradouro, número de porta, CEP, bairro, localidade e espécie de endereço com algoritmos de relevância e proximidade.
* **Busca Espacial por Polígono**: Selecione ou desenhe qualquer feição no mapa para listar instantaneamente todos os domicílios e estabelecimentos contidos nela.

### 📊 3. Raio-X Populacional & Dashboard
* **Resumo Demográfico e Territorial**: Indicadores consolidados de áreas e informações censitárias das feições selecionadas.
* **Tabela de Atributos Completa**: Consulta detalhada de propriedades com ordenação e filtros.

### 📁 4. Central de Exportação de Dados
* **Múltiplos Formatos**: Exporte seleções e resultados para planilhas **CSV (compatível com Excel / UTF-8 BOM)**, **KML (Google Earth e QGIS)** e **GeoJSON vetorial**.

### 🔐 5. Gestão de Acessos e Administração
* **Controle Granular de Permissões**: Perfis Master, Gerente e Visitante com liberação individual de camadas, colunas do CNEFE e ferramentas.
* **Logs e Auditoria**: Registro transparente de atividades de busca, visualização e exportação.
* **Modo Simulação (Master)**: Permite ao administrador visualizar e testar o WebGIS exatamente como qualquer usuário ou visitante vê.

### ⚡ 6. Otimizações de Performance Aplicadas
* **Divisão de Chunks (Code Splitting)**: Painel de Administrador, Dashboards e bibliotecas pesadas separadas sob demanda.
* **Carregamento Otimizado**: Favicon em arquivo SVG estático desacoplado do HTML e fontes consolidadas.
* **Scripts Multiplataforma**: Comandos de build e clean compatíveis tanto com Linux/Mac quanto Windows.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologias |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Motion (Framer Motion), Lucide React |
| **GIS & Geoprocessamento** | Leaflet, Leaflet-Measure, Turf.js (`@turf/boolean-point-in-polygon`, `@turf/helpers`) |
| **Banco Analítico & Dados** | DuckDB-WASM, Apache Parquet (Cloudflare R2), GeoJSON |
| **Backend & Autenticação** | Express, Node.js (`tsx`), Supabase Database |

---

## 🗄️ Configuração do Banco de Dados (Supabase)

Para habilitar a persistência em nuvem das permissões e sessões de usuários:

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com).
2. Vá até a seção **SQL Editor**.
3. Abra o arquivo [`supabase_schema.sql`](./supabase_schema.sql) deste repositório, copie o conteúdo e clique em **Run**.
4. Configure as variáveis no seu `.env` com base no `.env.example`.

> *Nota: Caso o Supabase não esteja configurado, o WebGIS funcionará normalmente utilizando armazenamento local (`localStorage`) de forma automática e transparente.*

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
* **Node.js** (versão 18 ou superior)
* **NPM** ou **Yarn**

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/marciodemelosilvageo-glitch/Teste-do-Site-web-gis-com-outro-Estilo.git
   cd Teste-do-Site-web-gis-com-outro-Estilo
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador:**
   Abra [http://localhost:5173](http://localhost:5173) ou [http://localhost:3000](http://localhost:3000)

---

## 📦 Build para Produção

Para gerar a versão otimizada de produção:

```bash
npm run build
```

Para iniciar o servidor compilado em produção:

```bash
npm start
```

---

## 👤 Autor e Contato

* **Desenvolvido por:** Márcio de Melo Silva
* **E-mail:** [marciodemelosilva.geo@gmail.com](mailto:marciodemelosilva.geo@gmail.com)
* **WhatsApp:** [(86) 98168-9456](https://wa.me/5586981689456)

---

<div align="center">
  <sub>WebGIS — Gerência de Dados • Todos os direitos reservados.</sub>
</div>
