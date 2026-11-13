import React, { useState } from 'react';

// Gerenciamento de Logos do Sistema
export const SYSTEM_LOGOS = {
  gerencia: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo.png",
  // Placeholder para envio posterior da versão com letras claras para GeoCode/logo
  gerenciaDark: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/Nova%20logo%20branca.png",
  fallback: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/image-removebg-preview.png",
  teste: "https://raw.githubusercontent.com/marciodemelosilvageo-glitch/GeoCode/main/logo/ChatGPT%20Image%209%20de%20ago.%20de%202026%2C%2017_43_35.png"
};

export const CURRENT_APP_LOGO = SYSTEM_LOGOS.gerencia;

export interface AppLogoProps {
  isDarkMode?: boolean;
  className?: string;
  onDoubleClick?: (e: React.MouseEvent) => void;
  title?: string;
  variant?: 'sidebar' | 'welcome';
}

/**
 * Componente unificado de exibição da logo institucional.
 * Suporta modo claro e escuro: tenta utilizar gerenciaDark se disponível;
 * caso ainda seja placeholder ou ocorra erro de carregamento, aplica automaticamente
 * o filtro CSS brightness-0 invert para que a logo preta fique perfeitamente branca e legível
 * contra fundos escuros, mantendo o modo claro e o modo de impressão 100% originais.
 */
export const AppLogo: React.FC<AppLogoProps> = ({
  isDarkMode = false,
  className = '',
  onDoubleClick,
  title,
  variant = 'sidebar'
}) => {
  const [darkImgFailed, setDarkImgFailed] = useState<boolean>(false);
  const [fallbackActive, setFallbackActive] = useState<boolean>(false);

  // Tenta utilizar a versão específica clara se estiver no tema escuro e não tiver falhado
  const shouldUseDarkImage = Boolean(isDarkMode && SYSTEM_LOGOS.gerenciaDark && !darkImgFailed);

  let src = SYSTEM_LOGOS.gerencia;
  if (fallbackActive) {
    src = SYSTEM_LOGOS.fallback;
  } else if (shouldUseDarkImage) {
    src = SYSTEM_LOGOS.gerenciaDark;
  }

  // Fallback visual com filtro CSS caso use a imagem normal no modo noturno
  const needsDarkFilter = isDarkMode && (!shouldUseDarkImage || darkImgFailed);

  const filterClasses = needsDarkFilter
    ? 'brightness-0 invert drop-shadow-[0_1px_2px_rgba(255,255,255,0.12)] print:filter-none print:brightness-100 print:invert-0'
    : '';

  const defaultClasses = variant === 'sidebar'
    ? 'h-9 sm:h-10 w-auto max-w-[135px] object-contain transition-transform group-hover:scale-105 pointer-events-none drop-shadow-xs'
    : 'h-14 sm:h-18 w-auto max-w-[210px] sm:max-w-[240px] object-contain drop-shadow-md hover:scale-[1.02] transition-transform duration-300 pointer-events-none';

  return (
    <div 
      className={`inline-flex items-center select-none ${onDoubleClick ? 'cursor-pointer group' : ''}`}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      <img
        src={src}
        alt="Logo"
        className={`${defaultClasses} ${filterClasses} ${className}`}
        onError={() => {
          if (shouldUseDarkImage) {
            setDarkImgFailed(true);
          } else if (!fallbackActive) {
            setFallbackActive(true);
          }
        }}
      />
    </div>
  );
};

export default AppLogo;
