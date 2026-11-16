import React from 'react';

export interface NavIconProps {
  size?: number;
  active?: boolean;
  className?: string;
}

/**
 * Raio-X Territorial (SF Symbol: person.2 / person.2.fill)
 */
export const DashboardIcon: React.FC<NavIconProps> = ({ size = 22, active = false, className = '' }) => {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        {/* Pessoa de fundo */}
        <path d="M16 8a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-1.3 0-2.5.4-3.4 1.1A5.5 5.5 0 0 1 18 16.5v.5h3.5A1.5 1.5 0 0 0 23 15.5v-1c0-2.5-4.7-4.5-7-4.5z" opacity="0.6" />
        {/* Pessoa principal (frente) */}
        <path d="M8 9a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2.5c-3 0-7 1.6-7 4.5V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2c0-2.9-4-4.5-7-4.5z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Pessoa de fundo */}
      <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M13 7a4 4 0 0 1 0-4" />
      {/* Pessoa principal */}
      <circle cx="8" cy="7" r="4" />
      <path d="M1 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
    </svg>
  );
};

/**
 * Detalhes da Feição (SF Symbol: mappin.and.ellipse / mappin.circle.fill)
 */
export const DetailsIcon: React.FC<NavIconProps> = ({ size = 22, active = false, className = '' }) => {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7.15 11.4 7.46 11.66a.8.8 0 0 0 1.08 0C12.85 21.4 20 15.25 20 10c0-4.42-3.58-8-8-8zm0 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21.5c-3.5-3.8-8-8.5-8-12a8 8 0 1 1 16 0c0 3.5-4.5 8.2-8 12z" />
      <circle cx="12" cy="9.5" r="2.8" />
    </svg>
  );
};

/**
 * Buscar (SF Symbol: magnifyingglass)
 */
export const SearchIcon: React.FC<NavIconProps> = ({ size = 22, active = false, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? "2.6" : "2.2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.8" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
    </svg>
  );
};

/**
 * Exportar (SF Symbol: square.and.arrow.up - clássico Share do iOS)
 */
export const ExportIcon: React.FC<NavIconProps> = ({ size = 22, active = false, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? "2.4" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Seta apontando para cima saindo do centro */}
      <polyline points="7.5 7.5 12 3 16.5 7.5" />
      <line x1="12" y1="3" x2="12" y2="14.5" />
      {/* Quadrado aberto na parte superior */}
      <path d="M4 11v8a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5v-8" />
    </svg>
  );
};

/**
 * Perfil / Usuário (SF Symbol: person.crop.circle / crown / briefcase)
 */
export interface ProfileNavIconProps extends NavIconProps {
  isMaster?: boolean;
  isManager?: boolean;
}

export const ProfileNavIcon: React.FC<ProfileNavIconProps> = ({
  size = 22,
  active = false,
  isMaster = false,
  isManager = false,
  className = ''
}) => {
  if (isMaster) {
    if (active) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden="true"
        >
          <path d="M2.5 19h19a1 1 0 0 0 1-1l-2.5-11a1 1 0 0 0-1.7-.4L14 10.5l-2-7a1 1 0 0 0-1.9 0l-2 7L3.7 6.6a1 1 0 0 0-1.7.4L-0.5 18a1 1 0 0 0 1 1h2zm-.5 1.5a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-0.5H2v0.5z" />
        </svg>
      );
    }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm0 16h20v2H2v-2z" />
      </svg>
    );
  }

  if (isManager) {
    if (active) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          aria-hidden="true"
        >
          <path fillRule="evenodd" clipRule="evenodd" d="M9 3a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a2 2 0 0 0-2-2H9zm1 3h4V5h-4v1zm-6 5v8h16v-8H4z" />
        </svg>
      );
    }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    );
  }

  // Padrão: Pessoa dentro de círculo (person.crop.circle)
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 14c-2.67 0-5.04-1.32-6.49-3.34.04-2.15 4.33-3.33 6.49-3.33s6.45 1.18 6.49 3.33A7.95 7.95 0 0 1 12 20z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9.5" r="3.2" />
      <path d="M5.5 18.5a7 7 0 0 1 13 0" />
    </svg>
  );
};
