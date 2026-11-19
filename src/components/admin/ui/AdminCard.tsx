import React from 'react';

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-xs p-4 sm:p-5 transition-all duration-200 ${
        hoverable || onClick
          ? 'cursor-pointer hover:border-black/[0.12] dark:hover:border-white/[0.15] active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
