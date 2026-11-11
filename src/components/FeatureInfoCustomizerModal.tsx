import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  SlidersHorizontal,
  Info
} from 'lucide-react';

export interface CustomCardOption {
  id: string;
  label: string;
  category?: 'demografia' | 'territorio' | 'seguranca' | 'localizacao' | 'atributo';
  propertyKey?: string; // se corresponder a uma chave de propriedade bruta para checagem de permissão
}

interface FeatureInfoCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableOptions: CustomCardOption[];
  selectedIds: string[];
  onSave: (newSelectedIds: string[]) => void;
  onReset: () => void;
  maxItems?: number;
}

export const FeatureInfoCustomizerModal: React.FC<FeatureInfoCustomizerModalProps> = ({
  isOpen,
  onClose,
  availableOptions,
  selectedIds,
  onSave,
  onReset,
  maxItems = 8
}) => {
  const [currentSelected, setCurrentSelected] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'selecionados' | 'catalogo'>('selecionados');

  useEffect(() => {
    if (isOpen) {
      setCurrentSelected([...selectedIds]);
    }
  }, [isOpen, selectedIds]);

  if (!isOpen) return null;

  // Toggle de seleção de um item
  const handleToggle = (id: string) => {
    setCurrentSelected(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // pelo menos 1 deve ficar ativo
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= maxItems) return prev; // limite atingido
        return [...prev, id];
      }
    });
  };

  // Mover item para cima na ordenação
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setCurrentSelected(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Mover item para baixo na ordenação
  const handleMoveDown = (index: number) => {
    if (index >= currentSelected.length - 1) return;
    setCurrentSelected(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleApply = () => {
    onSave(currentSelected);
    onClose();
  };

  const handleResetToDefault = () => {
    onReset();
    onClose();
  };

  const optionsMap = new Map(availableOptions.map(opt => [opt.id, opt]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#1c1c1e] rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
      >
        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 id="customizer-title" className="text-sm font-black text-slate-900 dark:text-white">
                Personalizar Informações
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Escolha até {maxItems} cartões para a barra de detalhes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Fechar editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas internas: Ordenar Selecionados vs Adicionar do Catálogo */}
        <div className="flex items-center px-4 pt-3 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('selecionados')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'selecionados'
                ? 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Ordem de Exibição ({currentSelected.length}/{maxItems})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('catalogo')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'catalogo'
                ? 'bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Catálogo de Campos ({availableOptions.length})
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {activeTab === 'selecionados' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1 mb-1">
                <span>Itens visíveis (arrume a ordem)</span>
                <span>{currentSelected.length} de {maxItems}</span>
              </div>

              {currentSelected.map((id, index) => {
                const opt = optionsMap.get(id);
                if (!opt) return null;
                return (
                  <div
                    key={id}
                    className="p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-black/5 dark:bg-white/10 text-[10px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {opt.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveUp(index)}
                        className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Mover para cima"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === currentSelected.length - 1}
                        onClick={() => handleMoveDown(index)}
                        className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={currentSelected.length <= 1}
                        onClick={() => handleToggle(id)}
                        className="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer ml-1"
                        title="Remover dos cartões"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1 mb-1">
                <span>Clique para marcar ou desmarcar</span>
                <span>{currentSelected.length}/{maxItems} selecionados</span>
              </div>

              {availableOptions.map(opt => {
                const isChecked = currentSelected.includes(opt.id);
                const canCheck = isChecked || currentSelected.length < maxItems;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!isChecked && !canCheck}
                    onClick={() => handleToggle(opt.id)}
                    className={`w-full p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                      isChecked
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                        : canCheck
                        ? 'bg-black/[0.02] dark:bg-white/[0.04] border-black/5 dark:border-white/5 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200'
                        : 'opacity-40 cursor-not-allowed border-black/5 dark:border-white/5 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold truncate">
                      {opt.label}
                    </span>

                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border ${
                      isChecked
                        ? 'bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-transparent'
                        : 'border-black/20 dark:border-white/20'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="px-5 py-3.5 border-t border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar padrão</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 transition-all shadow-sm cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

