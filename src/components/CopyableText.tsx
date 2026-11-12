import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check } from 'lucide-react';

export interface CopyableTextProps {
  value: string;
  label?: string;
  className?: string;
  title?: string;
  showToast?: (msg: string) => void;
  children?: React.ReactNode;
  onCopySuccess?: () => void;
}

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback para document.execCommand
    }
  }

  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch {
    return false;
  }

  return false;
};

export const CopyableText: React.FC<CopyableTextProps> = ({
  value,
  label = 'Texto',
  className = '',
  title,
  showToast,
  children,
  onCopySuccess
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [ripplePos, setRipplePos] = useState<{ x: number; y: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!value || value === '—') return;

    // Se o usuário selecionou texto manualmente com o mouse, não aciona a cópia automática
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ok = await copyTextToClipboard(value);
    if (!ok) {
      if (showToast) showToast(`Não foi possível copiar ${label}`);
      return;
    }

    if (showToast) showToast(`${label} copiado!`);
    if (onCopySuccess) onCopySuccess();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setRipplePos({ x, y });
    setIsCopied(true);

    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
      setRipplePos(null);
      timeoutRef.current = null;
    }, 1200);
  };

  const isInteractive = Boolean(value && value !== '—');

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={!isInteractive}
      whileTap={!prefersReducedMotion && isInteractive ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`group relative overflow-hidden inline-flex items-center text-left rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] ${
        isInteractive
          ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15'
          : 'cursor-default opacity-85'
      } ${className}`}
      title={title || (isInteractive ? `Clique para copiar ${label}` : label)}
      aria-label={label ? `Copiar ${label}` : undefined}
    >
      {/* Onda azul (ripple) partindo das coordenadas do clique */}
      {!prefersReducedMotion && ripplePos && (
        <motion.span
          key={`ripple-${ripplePos.x}-${ripplePos.y}`}
          initial={{ scale: 0, opacity: 0.45 }}
          animate={{ scale: 4.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute pointer-events-none rounded-full bg-[#007AFF]/20 dark:bg-[#007AFF]/30"
          style={{
            left: ripplePos.x - 15,
            top: ripplePos.y - 15,
            width: 30,
            height: 30,
          }}
        />
      )}

      {/* Troca de texto com AnimatePresence */}
      <AnimatePresence mode="wait" initial={false}>
        {isCopied ? (
          <motion.span
            key="copied"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="inline-flex items-center gap-1.5 font-black text-[#007AFF] dark:text-[#64D2FF] shrink-0"
          >
            <motion.span
              initial={prefersReducedMotion ? undefined : { scale: 0.5, rotate: -25 }}
              animate={prefersReducedMotion ? undefined : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 24 }}
              className="inline-flex items-center justify-center shrink-0"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </motion.span>
            <span className="truncate tracking-tight font-black">Copiado</span>
          </motion.span>
        ) : (
          <motion.span
            key="original"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="select-text truncate block w-full"
          >
            {children || value}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};
