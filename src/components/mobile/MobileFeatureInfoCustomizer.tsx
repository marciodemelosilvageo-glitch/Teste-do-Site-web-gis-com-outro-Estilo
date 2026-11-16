import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, Reorder, useDragControls, AnimatePresence } from 'motion/react';
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
      className="p-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 flex items-center justify-between gap-2 select-none relative"
      style={{ touchAction: 'pan-y' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Alça de arrasto touch */}
        <button
          type="button"
          aria-label={`Arraste para reordenar ${opt.label}`}
          onPointerDown={(e) => dragControls.start(e)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-black/5 dark:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="w-5 h-5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100 truncate">
          {opt.label}
        </span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {/* Botão Subir */}
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 disabled:opacity-20 flex items-center justify-center active:bg-black/5 dark:active:bg-white/10 cursor-pointer"
          aria-label={`Mover ${opt.label} para cima`}
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Botão Descer */}
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-slate-500 dark:text-slate-400 disabled:opacity-20 flex items-center justify-center active:bg-black/5 dark:active:bg-white/10 cursor-pointer"
          aria-label={`Mover ${opt.label} para baixo`}
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Botão Remover */}
        <button
          type="button"
          disabled={total <= 1}
          onClick={onRemove}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-rose-500 dark:text-rose-400 disabled:opacity-20 flex items-center justify-center active:bg-rose-500/10 cursor-pointer"
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
  historyIds: _historyIds = [],
  onSave,
  onReset,
  maxItems = 8,
  layerName
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>([...selectedIds]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    setCurrentSelected([...selectedIds]);
  }, [selectedIds]);

  // Indicador discreto de auto-salvamento
  const triggerSavedIndicator = useCallback(() => {
    setShowSavedIndicator(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => {
      setShowSavedIndicator(false);
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

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

  // Reordenação com auto-salvamento imediato
  const handleReorder = (newOrder: string[]) => {
    setCurrentSelected(newOrder);
    onSave(newOrder);
    triggerSavedIndicator();
  };

  // Reordenação por botões de acessibilidade com auto-save
  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= currentSelected.length) return;
    const next = [...currentSelected];
    const temp = next[target];
    next[target] = next[index];
    next[index] = temp;
    setCurrentSelected(next);
    onSave(next);
    triggerSavedIndicator();
  };

  // Adicionar item à seleção com auto-save
  const handleAdd = (id: string) => {
    if (currentSelected.length >= maxItems) return;
    if (currentSelected.includes(id)) return;
    const next = [...currentSelected, id];
    setCurrentSelected(next);
    onSave(next);
    triggerSavedIndicator();
  };

  // Remover item com auto-save (retorna para o catálogo de disponíveis)
  const handleRemove = (id: string) => {
    if (currentSelected.length <= 1) return; // mínimo 1 cartão
    const next = currentSelected.filter(item => item !== id);
    setCurrentSelected(next);
    onSave(next);
    triggerSavedIndicator();
  };

  // Restaurar padrão com auto-save
  const handleReset = () => {
    onReset();
    triggerSavedIndicator();
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

  // Catálogo dinâmico: NÃO exibe itens já selecionados
  const availableCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return availableOptions
      .filter(opt => !currentSelected.includes(opt.id))
      .filter(opt => {
        const matchesQuery = !query || opt.label.toLowerCase().includes(query) || opt.id.toLowerCase().includes(query);
        const matchesCategory = selectedCategory === 'todos' || opt.category === selectedCategory;
        return matchesQuery && matchesCategory;
      });
  }, [availableOptions, currentSelected, searchQuery, selectedCategory]);

  const isLimitReached = currentSelected.length >= maxItems;

  return (
    <div className="flex flex-col h-full w-full select-none">
      {/* 1. BARRA SUPERIOR ESTILO IOS (‹ Detalhes + Título + Status Salvo + Contador) */}
      <div className="px-3 py-1.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between gap-2 shrink-0 bg-white/95 dark:bg-[#1c1c1e]/95">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-0.5 text-[#007AFF] dark:text-[#0A84FF] text-[14px] font-semibold min-h-[44px] px-1 py-2 active:opacity-60 cursor-pointer"
          aria-label="Voltar para Detalhes"
        >
          <ChevronLeft className="w-5 h-5 -ml-1 stroke-[2.5]" />
          <span>Detalhes</span>
        </button>

        <div className="flex-1 text-center min-w-0 px-1">
          <h2 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
            Informações úteis
          </h2>
          {layerName && (
            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium truncate">
              {layerName}
            </p>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-1.5 min-w-[80px]">
          <AnimatePresence>
            {showSavedIndicator && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.16 }}
                className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
              >
                <Check className="w-3 h-3 stroke-[3]" />
                <span>Salvo</span>
              </motion.span>
            )}
          </AnimatePresence>

          <span className="px-2 py-0.5 rounded-full bg-[#007AFF]/10 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] text-[12px] font-black">
            {currentSelected.length}/{maxItems}
          </span>
        </div>
      </div>

      {/* 2. ÁREA ROLÁVEL COM CONTEÚDO (Sem rodapé obstrusivo) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-5 pb-[calc(env(safe-area-inset-bottom,0px)+32px)]">
        {/* SEÇÃO A: CARTÕES ESCOLHIDOS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
              Cartões em Exibição
            </h3>
            <span className="text-[12px] text-slate-500 dark:text-slate-400">
              Arraste a alça para ordenar
            </span>
          </div>

          <Reorder.Group
            axis="y"
            values={currentSelected}
            onReorder={handleReorder}
            className="space-y-1.5"
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
                  onRemove={() => handleRemove(id)}
                  onMove={(dir) => handleMove(index, dir)}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              );
            })}
          </Reorder.Group>
        </div>

        {/* SEÇÃO B: ADICIONAR INFORMAÇÃO */}
        <div className="space-y-2.5 pt-2 border-t border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
              Adicionar Informação
            </h3>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer py-1 px-2 rounded-lg active:bg-black/5 dark:active:bg-white/10"
              title="Restaurar cartões padrão desta camada"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar padrão</span>
            </button>
          </div>

          {/* Aviso quando o limite de itens for atingido */}
          {isLimitReached && (
            <div className="py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[12px] font-medium flex items-center gap-2">
              <span>Limite de {maxItems} informações atingido. Remova uma para adicionar outra.</span>
            </div>
          )}

          {/* Campo de Busca com Técnica Anti-zoom iOS (16px escalado visualmente para ~13px) */}
          <div className="relative h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 overflow-hidden flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none z-10" />
            <div className="w-full h-full flex items-center pl-8 pr-2" style={{ transformOrigin: 'left center' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar campo ou informação..."
                style={{
                  fontSize: '16px',
                  transform: 'scale(0.8125)', // 16px * 0.8125 = 13px visual
                  transformOrigin: 'left center',
                  width: '123.07%', // 1 / 0.8125
                }}
                className="h-full bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none border-none p-0"
              />
            </div>
          </div>

          {/* Chips de Categorias Roláveis */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-3.5 px-3.5 custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-1 px-3 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[36px] flex items-center ${
                  selectedCategory === cat.id
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Lista de Itens Disponíveis (apenas itens não adicionados) */}
          <div className="space-y-1">
            {availableCatalog.map(opt => (
              <button
                key={opt.id}
                type="button"
                disabled={isLimitReached}
                onClick={() => handleAdd(opt.id)}
                className={`w-full min-h-[44px] py-2 px-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                  isLimitReached
                    ? 'opacity-40 cursor-not-allowed border-black/5 dark:border-white/5 text-slate-400'
                    : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 text-slate-800 dark:text-slate-200 active:bg-black/5 cursor-pointer'
                }`}
              >
                <span className="text-[12.5px] font-semibold truncate">
                  {opt.label}
                </span>

                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border border-black/20 dark:border-white/20">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            ))}

            {availableCatalog.length === 0 && (
              <p className="text-center py-4 text-[12px] text-slate-400 italic">
                {availableOptions.length === currentSelected.length
                  ? "Todas as informações disponíveis já estão adicionadas."
                  : "Nenhuma informação encontrada nesta busca ou categoria."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
