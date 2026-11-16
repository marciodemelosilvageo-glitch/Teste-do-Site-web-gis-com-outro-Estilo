import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  MousePointerClick, 
  Table2, 
  Store, 
  Search, 
  Compass, 
  Download, 
  LifeBuoy, 
  Phone, 
  Mail, 
  MessageCircle, 
  ChevronDown 
} from 'lucide-react';

export interface HelpTabContentProps {
  className?: string;
}

/**
 * HelpTabContent - Guia de Uso & Ajuda compartilhado entre Desktop (AppleSidebar) e Mobile (MobileSheet).
 */
export const HelpTabContent: React.FC<HelpTabContentProps> = ({ className = '' }) => {
  const [collapsedCards, setCollapsedCards] = useState<Record<number, boolean>>({});

  const toggleCard = (id: number) => {
    setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    setCollapsedCards({});
  };

  const collapseAll = () => {
    const allCollapsed: Record<number, boolean> = {};
    for (let i = 1; i <= 10; i++) {
      allCollapsed[i] = true;
    }
    setCollapsedCards(allCollapsed);
  };

  return (
    <div className={`animate-fadeIn space-y-3 pb-6 select-text ${className}`}>
      {/* Header / Apresentação do Guia */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#007AFF]/10 via-[#5856D6]/5 to-transparent border border-[#007AFF]/20 shadow-xs">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-black text-sm text-slate-900 dark:text-white">
            Central de Ajuda WebGIS
          </h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
          Consulte as instruções rápidas de navegação, seleção de áreas, análise demográfica, consulta CNEFE e atalhos de produtividade sem sair do mapa.
        </p>
      </div>

      {/* Barra de Controle de Expansão Rápida */}
      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 select-none">
        <span>Tópicos do Guia (10 seções)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-[#007AFF] hover:underline cursor-pointer"
          >
            Expandir tudo
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      {/* 1. NAVEGAÇÃO E CAMADAS */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(1)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#007AFF]/15 text-[#007AFF] dark:text-[#64D2FF] flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span>1. Navegação &amp; Camadas</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[1] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[1] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Explore o território do Piauí com controle granular sobre temas espaciais e basemaps.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#007AFF] font-bold">•</span>
                <span><strong>Camadas Vetoriais Disponíveis:</strong> AISP, Aglomerados Rurais, Áreas de Desenvolvimento, Bairros, Comunidades Rurais de Teresina, Favelas e Comunidades, Localidades (Piauí), Municípios, Núcleos Urbanos e RISP.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#007AFF] font-bold">•</span>
                <span><strong>Painel de Camadas:</strong> Ative ou desative cada camada individualmente, alterne visibilidade rápida em <strong>"Ligar Tudo"</strong> / <strong>"Desligar Tudo"</strong> e reordene temas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#007AFF] font-bold">•</span>
                <span><strong>Mapas de Fundo Oficiais:</strong> Alterne entre <em> Explorar (Apple Maps Claro)</em>, <em> Escuro (Apple Maps Dark)</em>, <em>Satélite Google</em>, <em>Híbrido Google</em>, <em>OpenStreetMap</em> e <em>Esri World Imagery</em>.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 2. SELEÇÃO DE ÁREAS */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(2)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#34C759]/15 text-[#34C759] flex items-center justify-center shrink-0">
              <MousePointerClick className="w-3.5 h-3.5" />
            </div>
            <span>2. Seleção de Áreas &amp; Detalhes</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[2] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[2] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Interaja com qualquer polígono ou ponto com feedback visual imediato.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#34C759] font-bold">•</span>
                <span><strong>Clique Simples:</strong> Seleciona a feição e abre a aba <strong>"Detalhes da Feição"</strong> com nome oficial, município, metadados cadastrais, tabela de atributos e opções de busca.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#34C759] font-bold">•</span>
                <span><strong>Multiseleção:</strong> Segure <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono text-[10px]">Ctrl</kbd> no teclado ou ative o botão <strong>"Multiseleção: ON"</strong> para selecionar vários polígonos.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#34C759] font-bold">•</span>
                <span><strong>Dissolução Geométrica:</strong> Com 2 ou mais polígonos selecionados, use o botão <strong>"Dissolver"</strong> para unir as áreas em uma única geometria agregada.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 3. RAIO-X TERRITORIAL */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(3)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#5856D6]/15 text-[#5856D6] flex items-center justify-center shrink-0">
              <Table2 className="w-3.5 h-3.5" />
            </div>
            <span>3. Raio-X Territorial &amp; Domiciliar</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[3] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[3] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Agregador inteligente de dados censitários e estatísticos do IBGE para as áreas marcadas.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#5856D6] font-bold">•</span>
                <span><strong>Abertura Automática:</strong> Ao selecionar 2 ou mais feições elegíveis, o painel abre automaticamente na aba <strong>Raio-X</strong> somando domicílios particulares, coletivos e população.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#5856D6] font-bold">•</span>
                <span><strong>Comparativo e Lista de Áreas:</strong> Visualize a lista completa de feições agregadas, remova individualmente ou dê zoom com um toque.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#5856D6] font-bold">•</span>
                <span><strong>Busca CNEFE em Lote:</strong> Execute a busca de endereços ou estabelecimentos somando todas as áreas selecionadas de uma só vez.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 4. BUSCA AO VIVO E NAVEGAÇÃO */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(4)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shrink-0">
              <Search className="w-3.5 h-3.5" />
            </div>
            <span>4. Busca ao Vivo &amp; Resultados</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[4] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[4] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Pesquisa rápida em todas as camadas ativas e bases cartográficas.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#FF9500] font-bold">•</span>
                <span><strong>Centralização Silenciosa:</strong> Ao clicar em um resultado na lista de busca, o mapa voa e seleciona a feição sem sair da aba Buscar, permitindo conferir vários resultados em sequência.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#FF9500] font-bold">•</span>
                <span><strong>Acesso aos Detalhes:</strong> Depois de centralizar pelo resultado da busca, basta clicar diretamente na feição no mapa para abrir o painel completo de Detalhes.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 5. BUSCA POR TIPO & ESTABELECIMENTOS */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(5)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#FF2D55]/15 text-[#FF2D55] flex items-center justify-center shrink-0">
              <Store className="w-3.5 h-3.5" />
            </div>
            <span>5. Busca por Tipo &amp; Estabelecimentos</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[5] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[5] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Localize comércios, serviços essenciais e pontos de interesse CNEFE.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#FF2D55] font-bold">•</span>
                <span><strong>Menu "Buscar por Tipo":</strong> Nos Detalhes e no Raio-X, clique no menu suspenso para pesquisar <strong>Farmácias</strong>, <strong>Restaurantes</strong>, <strong>Postos de Gasolina</strong>, <strong>Hotéis</strong> e <strong>Hospitais</strong> dentro das áreas selecionadas.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#FF2D55] font-bold">•</span>
                <span><strong>Busca por Município:</strong> Na aba <em>Buscar</em>, escolha uma categoria e visualize estabelecimentos de municípios de todo o Piauí.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#FF2D55] font-bold">•</span>
                <span><strong>Busca por Raio (GPS):</strong> Busque estabelecimentos próximos a você usando raios de <strong>500 m</strong>, <strong>1 km</strong>, <strong>2 km</strong>, <strong>5 km</strong> ou <strong>10 km</strong>.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 6. BUSCA AVANÇADA DE ENDEREÇOS (CNEFE) E BARRA INFERIOR */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(6)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center shrink-0">
              <Search className="w-3.5 h-3.5" />
            </div>
            <span>6. Busca Avançada de Endereços (CNEFE)</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[6] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[6] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Consulta analítica de milhões de endereços do CNEFE / IBGE via DuckDB.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#AF52DE] font-bold">•</span>
                <span><strong>Botões "Buscar endereços":</strong> Disponíveis nos Detalhes, no Raio-X, no cartão de medição e botão específico <strong>"Buscar Endereços desta Localidade"</strong>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#AF52DE] font-bold">•</span>
                <span><strong>Indicador em Tempo Real:</strong> Uma barra animada de progresso indica o processamento da consulta de alta performance.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#AF52DE] font-bold">•</span>
                <span><strong>Barra Inferior Articulada:</strong> Arraste a barra para cima/baixo para ajustar a altura, use duplo clique ou botão de maximizar para tela cheia e clique em <strong>"Recolher"</strong> para priorizar o mapa.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#AF52DE] font-bold">•</span>
                <span><strong>Tabela Interativa:</strong> Ordene com ruas contínuas agrupadas, filtre por coluna com a lupa, selecione colunas em <strong>"Colunas ▼"</strong>, use <strong>"Plotar no Mapa"</strong> e exporte em CSV.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 7. COORDENADAS, MEDIÇÃO E BOTÃO DIREITO */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(7)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#00C7BE]/15 text-[#00C7BE] flex items-center justify-center shrink-0">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span>7. Coordenadas, Medição &amp; Botão Direito</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[7] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[7] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Ferramentas espaciais para navegação precisa e medição de campo.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#00C7BE] font-bold">•</span>
                <span><strong>Busca por Coordenadas:</strong> Digite coordenadas decimais (ex: <code>-5.089, -42.801</code>) na barra de busca para centralizar com pino e abrir detalhes imediatos.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#00C7BE] font-bold">•</span>
                <span><strong>Botão Direito no Mapa:</strong> Fixa pino no estilo Apple Maps, copia latitude/longitude individual ou em par, pesquisa feições no ponto e abre o local no <strong>Google Street View</strong>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#00C7BE] font-bold">•</span>
                <span><strong>Régua de Medição:</strong> Pressione <kbd className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono text-[10px]">M</kbd> ou use o botão flutuante para medir distâncias e áreas com cálculo geodésico; o cartão flutuante permite <strong>"Buscar Endereços"</strong> e <strong>"Exportar Geometria"</strong>.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 8. EXPORTAÇÃO DE DADOS */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(8)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#30B0C7]/15 text-[#30B0C7] flex items-center justify-center shrink-0">
              <Download className="w-3.5 h-3.5" />
            </div>
            <span>8. Exportação de Dados &amp; Formatos Oficiais</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[8] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[8] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Extração espacial e tabular de alta fidelidade sem perda de dados.
            </p>
            <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start gap-1.5">
                <span className="text-[#30B0C7] font-bold">•</span>
                <span><strong>Modos de Exportação:</strong> Escolha entre <strong>"Seleção Filtrada"</strong> (apenas feições selecionadas) e <strong>"Camada Completa"</strong> (toda a malha territorial da camada).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#30B0C7] font-bold">•</span>
                <span><strong>Formatos Suportados:</strong> <strong>GeoPackage (.gpkg)</strong> para QGIS e ArcGIS, <strong>Shapefile (.zip)</strong> com <code>.shp</code>, <code>.shx</code>, <code>.dbf</code>, <code>.prj</code> e <code>.cpg</code> (WGS 84 / EPSG:4326), <strong>KMZ (.kmz)</strong>, <strong>KML (.kml)</strong> e <strong>GeoJSON (.geojson)</strong>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#30B0C7] font-bold">•</span>
                <span><strong>Tabelas CSV:</strong> O formato <strong>CSV (.csv)</strong> é disponibilizado exclusivamente para camadas de pontos e listas de endereços CNEFE (camadas poligonais devem ser exportadas em formatos com suporte a geometria espacial).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#30B0C7] font-bold">•</span>
                <span><strong>Sem Excel (.xlsx):</strong> O sistema gera arquivos no formato CSV universal, diretamente compatível com Excel, LibreOffice e bancos de dados.</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* 9. ATALHOS DE TECLADO */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2.5">
        <button
          type="button"
          onClick={() => toggleCard(9)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-slate-500/15 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>9. Atalhos Rápidos de Produtividade</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[9] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[9] && (
          <div className="grid grid-cols-1 gap-2 text-xs pt-1 animate-fadeIn">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Focar no campo de busca</span>
              <div className="flex items-center gap-1">
                <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">Ctrl + F</kbd>
                <span className="text-[10px] text-slate-400">ou</span>
                <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">/</kbd>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Limpar seleções / Fechar painéis</span>
              <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">Esc</kbd>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Ativar / Desativar Régua de Medição</span>
              <kbd className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 font-mono text-[10px] font-bold border border-black/10 dark:border-white/10">M</kbd>
            </div>
          </div>
        )}
      </div>

      {/* 10. CONTATO E SUPORTE */}
      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 space-y-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
        <button
          type="button"
          onClick={() => toggleCard(10)}
          className="w-full flex items-center justify-between text-left text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#34C759]/15 text-[#34C759] flex items-center justify-center shrink-0">
              <LifeBuoy className="w-3.5 h-3.5" />
            </div>
            <span>10. Contato e Suporte</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${collapsedCards[10] ? '-rotate-90' : 'rotate-0'}`} />
        </button>
        {!collapsedCards[10] && (
          <div className="space-y-2 pt-1 animate-fadeIn">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Encontrou algum bug ou precisa de ajuda para usar o site? Entre em contato.
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              {/* Telefone */}
              <a
                href="tel:+5586981689456"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-[#007AFF] dark:hover:text-[#64D2FF] hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-blue-500/10 text-[#007AFF] dark:text-[#64D2FF] flex items-center justify-center shrink-0">
                  <Phone className="w-3 h-3" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Telefone</span>
                  <span className="font-semibold text-xs truncate">(86) 98168-9456</span>
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/5586981689456"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-[#34C759] dark:hover:text-[#30D158] hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-[#34C759] dark:text-[#30D158] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-3 h-3" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">WhatsApp</span>
                  <span className="font-semibold text-xs truncate">(86) 98168-9456</span>
                </div>
              </a>

              {/* E-mail */}
              <a
                href="mailto:marciodemelosilvageo@gmail.com"
                className="flex items-center gap-2.5 p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-[#007AFF] dark:hover:text-[#64D2FF] hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-[#5856D6] dark:text-[#5E5CE6] flex items-center justify-center shrink-0">
                  <Mail className="w-3 h-3" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">E-mail</span>
                  <span className="font-semibold text-xs truncate">marciodemelosilvageo@gmail.com</span>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
