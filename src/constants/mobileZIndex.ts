/**
 * Escala única de Z-Index para a interface Mobile (< 768px).
 * Garante hierarquia consistente sem sobreposições acidentais:
 * Elementos do mapa < Barra inferior < Backdrop < Gavetas < Popovers/Menus < Toasts < Modais globais.
 */
export const MOBILE_Z_INDEX = {
  // Elementos internos do mapa Leaflet
  LEGAL_SEAL: 10,
  LEGEND: 20,
  MAP_CONTROLS: 30,
  MEASURE_CARD: 30,
  LOADING_OVERLAY: 40,

  // Navegação móvel principal
  BOTTOM_NAV: 1000,

  // Gavetas inferiores e backdrops
  SHEET_BACKDROP: 1100,
  SHEET: 1200,

  // Popovers e Menus contextuais abertos
  POPOVER: 1300,

  // Avisos de ação e feedback rápido
  TOAST: 2000,

  // Modais de tela cheia (mantém padrão do sistema)
  FULLSCREEN_MODAL: 10005,
} as const;
