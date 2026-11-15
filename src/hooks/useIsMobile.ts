import { useState, useEffect } from 'react';

/**
 * Hook seguro para detecção de viewport mobile (largura < breakpoint).
 * Padrão: 768px (ou seja, telas com largura até 767px são mobile).
 * Atualiza automaticamente em redimensionamento, rotação de tela e carregamento.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Atualiza com o valor inicial preciso do matchMedia
    setIsMobile(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } else {
      // Compatibilidade com navegadores legados (Safari antigo)
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, [breakpoint]);

  return isMobile;
}
