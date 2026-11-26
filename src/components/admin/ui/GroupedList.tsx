import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface GroupedListProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const GroupedList: React.FC<GroupedListProps> = ({
  children,
  className = '',
  header,
  footer
}) => {
  return (
    <div className={`w-full mb-6 ${className}`}>
      {header && <div className="px-4 mb-2 select-none">{header}</div>}
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.06] shadow-xs">
        {children}
      </div>
      {footer && (
        <div className="px-4 mt-2 text-xs text-[#6C6C70] dark:text-[#98989D] leading-relaxed select-none">
          {footer}
        </div>
      )}
    </div>
  );
};

export interface GroupedListItemProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  iconBgClassName?: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  className?: string;
}

export const GroupedListItem: React.FC<GroupedListItemProps> = ({
  title,
  subtitle,
  icon: Icon,
  iconBgClassName,
  trailing,
  showChevron = false,
  onClick,
  disabled = false,
  destructive = false,
  className = ''
}) => {
  const isClickable = !!onClick && !disabled;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 transition-all ${
        isClickable
          ? 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.05] dark:active:bg-white/[0.06] active:scale-[0.99]'
          : ''
      } ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {Icon && (
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              iconBgClassName || 'bg-black/[0.04] dark:bg-white/[0.06] text-[#6C6C70] dark:text-[#98989D]'
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`text-[15px] font-medium leading-tight truncate ${
              destructive
                ? 'text-[#FF3B30] dark:text-[#FF453A]'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[#6C6C70] dark:text-[#98989D] mt-0.5 leading-snug line-clamp-1">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 select-none">
        {trailing && (
          <div className="text-xs text-[#6C6C70] dark:text-[#98989D] font-normal">
            {trailing}
          </div>
        )}
        {showChevron && (
          <ChevronRight className="w-4 h-4 text-[#8E8E93] dark:text-[#8E8E93] shrink-0" />
        )}
      </div>
    </div>
  );
};
