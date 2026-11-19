import React from 'react';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md'
}: SegmentedControlProps<T>) {
  const heightClass = size === 'sm' ? 'h-8 p-0.5' : 'h-10 p-1';
  const textClass = size === 'sm' ? 'text-xs' : 'text-xs sm:text-[13px]';

  return (
    <div
      role="tablist"
      className={`inline-flex items-center rounded-xl bg-black/[0.06] dark:bg-white/[0.08] select-none ${heightClass} ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.id === value;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.id)}
            className={`relative flex items-center justify-center gap-1.5 px-3 rounded-lg font-medium transition-all duration-200 cursor-pointer min-h-[32px] ${textClass} ${
              isSelected
                ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-xs'
                : 'text-[#6C6C70] dark:text-[#98989D] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-xs font-semibold ${
                  isSelected
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-slate-900 dark:text-white'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D]'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
