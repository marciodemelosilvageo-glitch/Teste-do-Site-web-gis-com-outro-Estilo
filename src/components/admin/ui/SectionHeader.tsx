import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex items-baseline justify-between px-3 mb-2 select-none ${className}`}>
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#6C6C70] dark:text-[#98989D]">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-[#8E8E93] dark:text-[#8E8E93] mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
