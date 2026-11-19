import React from 'react';

export type StatusDotVariant = 'online' | 'warning' | 'offline' | 'destructive';

interface StatusDotProps {
  status: StatusDotVariant;
  label?: string;
  className?: string;
  ping?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  className = '',
  ping = false
}) => {
  const colorClass = {
    online: 'bg-[#34C759] dark:bg-[#30D158]',
    warning: 'bg-[#FF9500] dark:bg-[#FF9F0A]',
    offline: 'bg-[#8E8E93] dark:bg-[#636366]',
    destructive: 'bg-[#FF3B30] dark:bg-[#FF453A]'
  }[status];

  return (
    <span className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <span className="relative flex h-2 w-2 items-center justify-center">
        {ping && status === 'online' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-[#34C759] dark:bg-[#30D158]" />
        )}
        <span className={`relative inline-block h-2 w-2 rounded-full ${colorClass}`} />
      </span>
      {label && (
        <span className="text-xs text-[#6C6C70] dark:text-[#98989D] font-medium">
          {label}
        </span>
      )}
    </span>
  );
};
