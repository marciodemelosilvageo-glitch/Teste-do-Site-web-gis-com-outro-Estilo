import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
  onClear
}) => {
  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
  };

  return (
    <div className={`relative flex items-center w-full min-h-[44px] ${className}`}>
      <Search className="absolute left-3.5 w-4 h-4 text-[#8E8E93] dark:text-[#8E8E93] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-9 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] border border-transparent focus:border-[#007AFF]/40 dark:focus:border-[#0A84FF]/40 text-slate-900 dark:text-slate-100 placeholder-[#8E8E93] text-sm focus:outline-none transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 p-1 rounded-full text-[#8E8E93] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
