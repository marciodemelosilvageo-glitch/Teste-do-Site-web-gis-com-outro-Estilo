import React from 'react';
import { StatusDot } from './StatusDot';

interface BannerProps {
  title?: string;
  message: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  isWarning?: boolean;
  action?: React.ReactNode;
  className?: string;
}

export const Banner: React.FC<BannerProps> = ({
  title,
  message,
  icon: Icon,
  isWarning = false,
  action,
  className = ''
}) => {
  return (
    <div
      className={`rounded-2xl p-4 bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] flex items-start gap-3.5 ${className}`}
    >
      {Icon && (
        <div className="w-8 h-8 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center shrink-0 text-[#6C6C70] dark:text-[#98989D] mt-0.5">
          <Icon className="w-4 h-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isWarning && <StatusDot status="warning" />}
          {title && (
            <h4 className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
              {title}
            </h4>
          )}
        </div>
        <div className="text-xs sm:text-sm text-[#6C6C70] dark:text-[#98989D] leading-relaxed">
          {message}
        </div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
};
