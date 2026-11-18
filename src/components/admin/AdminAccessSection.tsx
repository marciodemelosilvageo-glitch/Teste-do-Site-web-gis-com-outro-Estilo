import React, { useState } from 'react';
import {
  Layers,
  Wrench,
  TableProperties,
  Info,
  Check,
  CheckCheck,
  Sparkles,
  MapPin,
  Ruler,
  Printer,
  BarChart3,
  ListTree,
  FileSpreadsheet,
  Globe,
  Combine,
  FileCode,
  Archive,
  Database,
  Sliders,
  HelpCircle
} from 'lucide-react';
import {
  FeaturePermissions,
  ALL_ADDRESS_COLUMNS,
  ALL_FEATURE_PROPERTIES
} from '../../services/adminService';
import { dataSources } from '../../data';

interface AdminAccessSectionProps {
  isMaster: boolean;
  isManager: boolean;
  localLayerPerms: Record<string, boolean>;
  onToggleLayer: (layerName: string) => void;
  onToggleAllLayers: (allow: boolean) => void;
  localFeaturePerms: FeaturePermissions;
  onToggleFeature: (featureKey: keyof FeaturePermissions) => void;
  onApplyPreset: (preset: 'visitor' | 'user' | 'manager') => void;
  localAddressColumns: Record<string, boolean>;
  onToggleAddressColumn: (colKey: string) => void;
  onToggleAllAddressColumns: (allow: boolean) => void;
  localFeatureProperties: Record<string, boolean>;
  onToggleFeatureProperty: (propKey: string) => void;
  onToggleAllFeatureProperties: (allow: boolean) => void;
}

export const AdminAccessSection: React.FC<AdminAccessSectionProps> = ({
  isMaster,
  localLayerPerms,
  onToggleLayer,
  onToggleAllLayers,
  localFeaturePerms,
  onToggleFeature,
  onApplyPreset,
  localAddressColumns,
  onToggleAddressColumn,
  onToggleAllAddressColumns,
  localFeatureProperties,
  onToggleFeatureProperty,
  onToggleAllFeatureProperties
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'layers' | 'features' | 'columns'>('features');

  // Interruptor Estilo iOS Nativo (Apple Switch)
  const IOSToggle: React.FC<{
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    title: string;
    description: string;
    icon?: React.ComponentType<{ className?: string }>;
  }> = ({ checked, onChange, disabled, title, description, icon: Icon }) => (
    <div
      onClick={() => !disabled && onChange()}
      className={`min-h-[52px] p-3.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-3 cursor-pointer select-none transition-all hover:border-black/10 dark:hover:border-white/10 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            {description}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        <div className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#34C759]' : 'bg-slate-200 dark:bg-slate-700'}`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow-xs transition-transform absolute top-0.5 left-0.5 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Banner Informativo Apple */}
      <div className="p-3.5 bg-[#007AFF]/10 dark:bg-[#007AFF]/15 border border-[#007AFF]/20 rounded-2xl flex items-start gap-2.5 text-[#007AFF] dark:text-[#0a84ff]">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <span className="font-bold">Políticas Globais de Acesso: </span>
          As configurações abaixo aplicam-se a todos os visitantes e usuários que não possuem permissões personalizadas individuais configuradas em seus perfis.
        </div>
      </div>

      {/* Barra de Sub-abas Segmentadas Estilo iOS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-black/[0.04] dark:border-white/[0.06]">
        <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('features')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial ${
              activeSubTab === 'features'
                ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Ferramentas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('layers')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial ${
              activeSubTab === 'layers'
                ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Camadas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/5 dark:bg-white/10 font-bold ml-0.5">
              {dataSources.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('columns')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 sm:flex-initial ${
              activeSubTab === 'columns'
                ? 'bg-white dark:bg-[#252528] text-[#007AFF] dark:text-[#0a84ff] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>Colunas & Dados</span>
          </button>
        </div>

        {/* Predefinições Rápidas de Papel (Presets) */}
        {isMaster && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Predefinições:
            </span>
            <button
              type="button"
              onClick={() => onApplyPreset('visitor')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer shrink-0 transition-colors"
              title="Aplicar perfil recomendado para visitantes públicos"
            >
              Visitante
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('user')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer shrink-0 transition-colors"
              title="Aplicar perfil recomendado para usuários comuns cadastrados"
            >
              Usuário
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('manager')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer shrink-0 transition-colors"
              title="Liberar todas as ferramentas e camadas"
            >
              Gerente
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          SUB-ABA 1: FERRAMENTAS E MÓDULOS (INCLUINDO OS NOVOS)
         ======================================================== */}
      {activeSubTab === 'features' && (
        <div className="space-y-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
            Módulos de Navegação & Análise Espacial
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <IOSToggle
              checked={localFeaturePerms.allowDissolveFeatures !== false}
              onChange={() => onToggleFeature('allowDissolveFeatures')}
              title="Dissolver Feições Poligonais"
              description="Permite unir 2 ou mais polígonos selecionados em um contorno único fundido."
              icon={Combine}
            />

            <IOSToggle
              checked={localFeaturePerms.allowMultiSelect !== false}
              onChange={() => onToggleFeature('allowMultiSelect')}
              title="Multiseleção de Feições"
              description="Permite alternar para o modo de multiseleção de feições no mapa."
              icon={ListTree}
            />

            <IOSToggle
              checked={localFeaturePerms.allowSearchByType !== false}
              onChange={() => onToggleFeature('allowSearchByType')}
              title="Buscar por Categoria (Tipo)"
              description="Pesquisa rápida de Farmácias, Restaurantes, Postos, Hotéis e Hospitais."
              icon={MapPin}
            />

            <IOSToggle
              checked={localFeaturePerms.allowSearchAreaAddresses !== false}
              onChange={() => onToggleFeature('allowSearchAreaAddresses')}
              title="Buscar Endereços na Área"
              description="Permite buscar e tabular endereços CNEFE dentro de polígonos e medições."
              icon={MapPin}
            />

            <IOSToggle
              checked={localFeaturePerms.allowCustomizeUsefulInfo !== false}
              onChange={() => onToggleFeature('allowCustomizeUsefulInfo')}
              title="Personalizar Informações Úteis"
              description="Permite ao usuário customizar e ordenar os cartões de dados na barra lateral."
              icon={Sliders}
            />

            <IOSToggle
              checked={localFeaturePerms.allowCnefeSearch !== false}
              onChange={() => onToggleFeature('allowCnefeSearch')}
              title="Busca CNEFE e Avançada"
              description="Consulta de endereços completos do CNEFE / IBGE no rodapé do mapa."
              icon={MapPin}
            />

            <IOSToggle
              checked={localFeaturePerms.allowDashboardRaioX !== false}
              onChange={() => onToggleFeature('allowDashboardRaioX')}
              title="Painel Raio-X Territorial"
              description="Indicadores demográficos e censitários consolidados da feição."
              icon={BarChart3}
            />

            <IOSToggle
              checked={localFeaturePerms.allowMeasureTool !== false}
              onChange={() => onToggleFeature('allowMeasureTool')}
              title="Ferramenta de Medição"
              description="Régua de distâncias e cálculo geodésico de áreas no mapa."
              icon={Ruler}
            />

            <IOSToggle
              checked={localFeaturePerms.allowPrintA4 !== false}
              onChange={() => onToggleFeature('allowPrintA4')}
              title="Impressão de Mapa em A4"
              description="Gera documento em alta definição para impressão paisagem ou retrato."
              icon={Printer}
            />

            <IOSToggle
              checked={localFeaturePerms.allowLayerPanel !== false}
              onChange={() => onToggleFeature('allowLayerPanel')}
              title="Painel de Camadas"
              description="Acesso ao menu de ativação e estilização das camadas no mapa."
              icon={Layers}
            />

            <IOSToggle
              checked={localFeaturePerms.allowBasemapSelector !== false}
              onChange={() => onToggleFeature('allowBasemapSelector')}
              title="Seletor de Mapa Base"
              description="Permite alternar entre Satélite, Modo Escuro, Padrão e Topográfico."
              icon={Globe}
            />

            <IOSToggle
              checked={localFeaturePerms.allowMapLegend !== false}
              onChange={() => onToggleFeature('allowMapLegend')}
              title="Legenda do Mapa"
              description="Exibe a caixa de legenda com os símbolos das feições ativas."
              icon={HelpCircle}
            />

            <IOSToggle
              checked={localFeaturePerms.allowSelectedFeaturesPanel !== false}
              onChange={() => onToggleFeature('allowSelectedFeaturesPanel')}
              title="Painel de Feições Selecionadas"
              description="Barra flutuante inferior com a lista dos itens marcados no mapa."
              icon={ListTree}
            />

            <IOSToggle
              checked={localFeaturePerms.allowFeatureSpecs !== false}
              onChange={() => onToggleFeature('allowFeatureSpecs')}
              title="Especificações Técnicas da Feição"
              description="Exibe metadados e parâmetros estruturais detalhados do dado espacial."
              icon={TableProperties}
            />

            <IOSToggle
              checked={localFeaturePerms.allowSourcesFooter !== false}
              onChange={() => onToggleFeature('allowSourcesFooter')}
              title="Rodapé de Fontes e Dados"
              description="Créditos e referências cartográficas do IBGE e bases governamentais."
              icon={Info}
            />

            <IOSToggle
              checked={localFeaturePerms.allowSearchActiveLayersOnly !== false}
              onChange={() => onToggleFeature('allowSearchActiveLayersOnly')}
              title="Pesquisar Só nas Camadas Ativas"
              description="Opção na busca lateral para restringir o filtro às camadas ligadas."
              icon={Layers}
            />
          </div>

          {/* Subseção de Exportações por Formato */}
          <div className="pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2.5">
              Exportação de Dados por Formato
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <IOSToggle
                checked={localFeaturePerms.allowExportData !== false}
                onChange={() => onToggleFeature('allowExportData')}
                title="Habilitar Exportações (Geral)"
                description="Interruptor mestre para liberar o botão e modal de exportação."
                icon={FileSpreadsheet}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportCsv !== false}
                onChange={() => onToggleFeature('allowExportCsv')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar CSV (Planilhas)"
                description="Exportação tabular compatível com Excel e Google Planilhas."
                icon={FileSpreadsheet}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportGeoJson !== false}
                onChange={() => onToggleFeature('allowExportGeoJson')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar GeoJSON"
                description="Padrão aberto universal para dados vetoriais web."
                icon={FileCode}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportKml !== false}
                onChange={() => onToggleFeature('allowExportKml')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar KML"
                description="Formato vetorial aberto para Google Earth e mapas web."
                icon={Globe}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportKmz !== false}
                onChange={() => onToggleFeature('allowExportKmz')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar KMZ"
                description="Pacote compactado com estilos embutidos do Google Earth."
                icon={Archive}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportShapefile !== false}
                onChange={() => onToggleFeature('allowExportShapefile')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar Shapefile (ZIP / SHP)"
                description="Formato clássico amplamente utilizado em softwares SIG (QGIS/ArcGIS)."
                icon={Database}
              />

              <IOSToggle
                checked={localFeaturePerms.allowExportGeoPackage !== false}
                onChange={() => onToggleFeature('allowExportGeoPackage')}
                disabled={localFeaturePerms.allowExportData === false}
                title="Exportar GeoPackage (GPKG)"
                description="Padrão moderno em banco SQLite do consórcio OGC."
                icon={Database}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-ABA 2: CAMADAS DISPONÍVEIS GLOBALMENTE
         ======================================================== */}
      {activeSubTab === 'layers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Camadas Cartográficas do WebGIS ({dataSources.length})
            </span>

            {isMaster && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onToggleAllLayers(true)}
                  className="font-semibold text-[#007AFF] hover:underline cursor-pointer"
                >
                  Liberar Todas
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => onToggleAllLayers(false)}
                  className="font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Bloquear Todas
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {dataSources.map((source) => {
              const isAllowed = localLayerPerms[source.name] !== false;
              return (
                <IOSToggle
                  key={source.name}
                  checked={isAllowed}
                  onChange={() => onToggleLayer(source.name)}
                  title={source.name}
                  description="Camada vetorial territorial no mapa."
                  icon={Layers}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-ABA 3: COLUNAS E LINHAS DE DADOS
         ======================================================== */}
      {activeSubTab === 'columns' && (
        <div className="space-y-6">
          {/* Seção 1: Colunas de Endereço CNEFE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Colunas de Endereço CNEFE ({ALL_ADDRESS_COLUMNS.length})
              </span>

              {isMaster && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleAllAddressColumns(true)}
                    className="font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    Ativar Todas
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => onToggleAllAddressColumns(false)}
                    className="font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Desativar Todas
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_ADDRESS_COLUMNS.map((col) => {
                const isAllowed = localAddressColumns[col.key] !== false;
                return (
                  <div
                    key={col.key}
                    onClick={() => onToggleAddressColumn(col.key)}
                    className="min-h-[44px] p-2.5 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer select-none hover:border-black/10 dark:hover:border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {col.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {col.key}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${isAllowed ? 'bg-[#34C759]' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform absolute top-0.5 left-0.5 ${isAllowed ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seção 2: Propriedades Técnicas de Feições */}
          <div className="space-y-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Propriedades Técnicas e Demográficas ({ALL_FEATURE_PROPERTIES.length})
              </span>

              {isMaster && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => onToggleAllFeatureProperties(true)}
                    className="font-semibold text-[#007AFF] hover:underline cursor-pointer"
                  >
                    Ativar Todas
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => onToggleAllFeatureProperties(false)}
                    className="font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Desativar Todas
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_FEATURE_PROPERTIES.map((prop) => {
                const isAllowed = localFeatureProperties[prop.key] !== false;
                return (
                  <div
                    key={prop.key}
                    onClick={() => onToggleFeatureProperty(prop.key)}
                    className="min-h-[44px] p-2.5 bg-white dark:bg-[#1c1c1e] rounded-xl border border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer select-none hover:border-black/10 dark:hover:border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {prop.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {prop.key}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div className={`w-9 h-5 rounded-full transition-colors relative ${isAllowed ? 'bg-[#34C759]' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-transform absolute top-0.5 left-0.5 ${isAllowed ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
