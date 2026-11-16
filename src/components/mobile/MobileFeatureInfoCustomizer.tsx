import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, Reorder, useDragControls } from 'motion/react';
import {
  ChevronLeft,
  Search,
  Plus,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
  RotateCcw
} from 'lucide-react';

export interface CustomCardOption {
  id: string;
  label: string;
  category?: 'demografia' | 'territorio' | 'seguranca' | 'localizacao' | 'atributo';
  propertyKey?: string;
}

export interface MobileFeatureInfoCustomizerProps {
  onClose: () => void;
  availableOptions: CustomCardOption[];
  allOptionsMap?: Record<string, { label: string; value?: string }>;
  selectedIds: string[];
  historyIds?: string[];
  onSave: (newSelectedIds: string[]) => void;
  onReset: () => void;
  maxItems?: number;
  layerName?: string;
}

interface MobileReorderItemProps {
  id: string;
  opt: CustomCardOption;
  index: number;
  total: number;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  prefersReducedMotion: boolean;
}

const MobileReorderItem: React.FC<MobileReorderItemProps> = ({
  id,
  opt,
  index,
  total,
  onRemove,
  onMove,
  prefersReducedMotion
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      id={`mobile-reorder-${id}`}
      dragListener={false}
      dragControls={dragControls}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
      className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 flex items-center justify-between gap-2 select-none relative"
      style={{ touchAction: 'pan-y' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Alça de arrasto touch */}
        <button
          type="button"
          aria-label={`Arraste para reordenar ${opt.label}`}
          onPointerDown={(e) => dragControls.start(e)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        <span className="w-6 h-6 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">
          {opt.label}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Botão Subir */}
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 disabled:opacity-20 flex items-center justify-center active:bg-black/5 dark:active:bg-white/10"
          aria-label={`Mover ${opt.label} para cima`}
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Botão Descer */}
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 disabled:opacity-20 flex items-center justify-center active:bg-black/5 dark:active:bg-white/10"
          aria-label={`Mover ${opt.label} para baixo`}
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Botão Remover */}
        <button
          type="button"
          disabled={total <= 1}
          onClick={onRemove}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-rose-500 dark:text-rose-400 disabled:opacity-20 flex items-center justify-center active:bg-rose-500/10"
          aria-label={`Remover ${opt.label}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Reorder.Item>
  );
};

export const MobileFeatureInfoCustomizer: React.FC<MobileFeatureInfoCustomizerProps> = ({
  onClose,
  availableOptions,
  allOptionsMap,
  selectedIds,
  historyIds = [],
  onSave,
  onReset,
  maxItems = 8,
  layerName
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>([...selectedIds]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    setCurrentSelected([...selectedIds]);
  }, [selectedIds]);

  const optionsMap = useMemo(() => {
    return new Map(availableOptions.map(opt => [opt.id, opt]));
  }, [availableOptions]);

  const getOption = useCallback((id: string): CustomCardOption => {
    return optionsMap.get(id) || {
      id,
      label: allOptionsMap?.[id]?.label || id,
      category: 'atributo'
    };
  }, [optionsMap, allOptionsMap]);

  // Reordenação por botões de acessibilidade
  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= currentSelected.length) return;
    setCurrentSelected(prev => {
      const next = [...prev];
      const temp = next[target];
      next[target] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Toggle de seleção
  const handleToggle = (id: string) => {
    setCurrentSelected(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // mínimo 1
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= maxItems) return prev; // limite atingido
        return [...prev, id];
      }
    });
  };

  // Categorias disponíveis
  const categories = useMemo(() => [
    { id: 'todos', label: 'Todos' },
    { id: 'demografia', label: 'Demografia' },
    { id: 'territorio', label: 'Território' },
    { id: 'seguranca', label: 'Segurança' },
    { id: 'localizacao', label: 'Localização' },
    { id: 'atributo', label: 'Atributos' }
  ], []);

  // Catálogo ordenado: Selecionados primeiro, depois histórico, depois demais
  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return availableOptions.filter(opt => {
      const matchesQuery = !query || opt.label.toLowerCase().includes(query) || opt.id.toLowerCase().includes(query);
      const matchesCategory = selectedCategory === 'todos' || opt.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [availableOptions, searchQuery, selectedCategory]);

  const handleApply = () => {
    onSave(currentSelected);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* 1. BARRA SUPERIOR ESTILO IOS (‹ Detalhes + Título + Contador) */}
      <div className="px-3 py-2 border-b border-black/5 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 bg-white/95 dark:bg-[#1c1c1e]/95">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-0.5 text-[#007AFF] dark:text-[#0A84FF] text-[15px] font-semibold min-h-[44px] px-1 py-2 active:opacity-60 cursor-pointer"
          aria-label="Voltar para Detalhes"
        >
          <ChevronLeft className="w-5 h-5 -ml-1 stroke-[2.5]" />
          <span>Detalhes</span>
        </button>

        <div className="flex-1 text-center min-w-0 px-1">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white truncate">
            Informações úteis
          </h2>
          {layerName && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {layerName}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end">
          <span className="px-2 py-1 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-black">
            {currentSelected.length} de {maxItems}
          </span>
        </div>
      </div>

      {/* 2. ÁREA ROLÁVEL COM CONTEÚDO */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* SEÇÃO A: CARTÕES ESCOLHIDOS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Cartões em Exibição
            </h3>
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              Segure na alça para ordenar
            </span>
          </div>

          <Reorder.Group
            axis="y"
            values={currentSelected}
            onReorder={setCurrentSelected}
            className="space-y-2"
            layoutScroll
          >
            {currentSelected.map((id, index) => {
              const opt = getOption(id);
              return (
                <MobileReorderItem
                  key={id}
                  id={id}
                  opt={opt}
                  index={index}
                  total={currentSelected.length}
                  onRemove={() => handleToggle(id)}
                  onMove={(dir) => handleMove(index, dir)}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              );
            })}
          </Reorder.Group>
        </div>

        {/* SEÇÃO B: ADICIONAR INFORMAÇÃO */}
        <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Adicionar Informação
            </h3>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer py-1 px-2 rounded-lg"
              title="Restaurar cartões padrão desta camada"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar padrão</span>
            </button>
          </div>

          {/* Campo de Busca (fonte 16px obrigatória no iOS Safari) */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar campo ou informação..."
              className="w-full h-11 pl-9 pr-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 text-[16px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#007AFF]"
            />
          </div>

          {/* Chips de Categorias Roláveis */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1.5 px-3 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[36px] flex items-center ${
                  selectedCategory === cat.id
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Lista de Itens do Catálogo */}
          <div className="space-y-1.5">
            {filteredCatalog.map(opt => {
              const isSelected = currentSelected.includes(opt.id);
              const canSelect = isSelected || currentSelected.length < maxItems;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!isSelected && !canSelect}
                  onClick={() => handleToggle(opt.id)}
                  className={`w-full min-h-[48px] p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 border-[#007AFF]/30 text-[#007AFF] dark:text-[#0A84FF]'
                      : canSelect
                      ? 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200 active:bg-black/5'
                      : 'opacity-40 cursor-not-allowed border-black/5 dark:border-white/5 text-slate-400'
                  }`}
                >
                  <span className="text-[13px] font-bold truncate">
                    {opt.label}
                  </span>

                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border ${
                    isSelected
                      ? 'bg-[#007AFF] text-white border-transparent'
                      : 'border-black/20 dark:border-white/20'
                  }`}>
                    {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                  </div>
                </button>
              );
            })}

            {filteredCatalog.length === 0 && (
              <p className="text-center py-4 text-[13px] text-slate-400 italic">
                Nenhuma informação encontrada nesta categoria.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. RODAPÉ FIXO DE AÇÕES (Cancelar e Salvar) */}
      <div className="p-3 border-t border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#1c1c1e]/95 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 min-h-[44px] py-2 px-4 rounded-xl text-[14px] font-bold text-slate-600 dark:text-slate-300 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 active:scale-98 transition-all cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={handleApply}
          className="flex-1 min-h-[44px] py-2 px-4 rounded-xl text-[14px] font-bold text-white bg-[#007AFF] hover:bg-[#0071E3] active:scale-98 transition-all shadow-sm cursor-pointer"
        >
          Salvar
        </button>
      </div>
    </div>
  );
};
