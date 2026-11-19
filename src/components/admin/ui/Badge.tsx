import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'neutral' | 'accent' | 'destructive';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  icon: Icon,
  variant = 'neutral',
  className = ''
}) => {
  const variantStyles = {
    neutral: 'bg-black/[0.05] dark:bg-white/[0.08] text-[#6C6C70] dark:text-[#98989D] border border-black/[0.04] dark:border-white/[0.06]',
    accent: 'bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF] border border-[#007AFF]/20 dark:border-[#0A84FF]/25',
    destructive: 'bg-[#FF3B30]/10 dark:bg-[#FF453A]/15 text-[#FF3B30] dark:text-[#FF453A] border border-[#FF3B30]/20 dark:border-[#FF453A]/25'
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium tracking-tight select-none ${variantStyles} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
      <span>{children}</span>
    </span>
  );
};
