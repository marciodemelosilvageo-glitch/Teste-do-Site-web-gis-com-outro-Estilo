import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet-measure/dist/leaflet-measure.css';

// Configuração dos ícones padrão do Leaflet para Vite/Vercel (evita erro 404 de marker-icon.png e marker-shadow.png)
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: '/marker-icon.png',
    iconRetinaUrl: '/marker-icon-2x.png',
    shadowUrl: '/marker-shadow.png',
    imagePath: '/',
  });
}
import { Layers, ZoomIn, Compass, ExternalLink, MousePointerClick, Search, GripVertical, Save, BookmarkCheck, Trash2, RotateCcw, Eye, EyeOff, X, Check, AlertCircle, Ruler, LocateFixed, Navigation, ChevronDown, ChevronUp, MapPin, Star, Plus, Minus, Map as MapIcon, Download, Combine } from 'lucide-react';
import { union } from '@turf/union';
import { featureCollection } from '@turf/helpers';
import { DataSource, SelectedFeature, ContextMenuState, SavedStylePreset } from '../types';
import { dataSources, situationMap, typeMap, propertyNames, getLayerColor, DEFAULT_ACTIVE_LAYERS } from '../data';
import { getIdentifier, getTranslatedValue, getFeatureCenter, patchMeasureControl, haversineDistanceMeters, formatDistance, calculateGeodesicAreaMeters, formatArea, toTitleCase, exportSelectionToCSV, exportSelectionToKML, downloadFile, sanitizeFilename } from '../utils';
import { createCategoryPinIcon, detectCategoryFromData } from '../categories';

// Calculo inteligente de amostragem espacial por grade geográfica
// Garante que NUNCA haja pontos empilhados ou amontoados em zooms distantes (desaproximados)
const computeSpatialMinZooms = (features: any[]): Map<any, number> => {
  const minZoomMap = new Map<any, number>();

  // Grade espacial por nível de zoom (8 a 14)
  const gridOccupied: Record<number, Set<string>> = {
    8: new Set(),
    9: new Set(),
    10: new Set(),
    11: new Set(),
    12: new Set(),
    13: new Set(),
    14: new Set(),
  };

  // Ordenar para dar prioridade a SEDEs, Aglomerados ou localidades com maiores relevâncias
  const sorted = [...features].sort((a, b) => {
    const propsA = a?.properties || {};
    const propsB = b?.properties || {};
    const isMajorA = !!(propsA.Agromerado || propsA.SEDE || propsA.SITUACAO === 'Urbana' || propsA.SITUACAO === 'URBANA');
    const isMajorB = !!(propsB.Agromerado || propsB.SEDE || propsB.SITUACAO === 'Urbana' || propsB.SITUACAO === 'URBANA');
    if (isMajorA !== isMajorB) return isMajorA ? -1 : 1;
    return (Number(propsA.id_Localidades) || 0) - (Number(propsB.id_Localidades) || 0);
  });

  for (const feature of sorted) {
    const geom = feature?.geometry;
    let lat = NaN, lng = NaN;
    if (geom && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      lng = Number(geom.coordinates[0]);
      lat = Number(geom.coordinates[1]);
    } else {
      const props = feature?.properties || {};
      if (props.latitude && props.longitude) {
        lat = Number(props.latitude);
        lng = Number(props.longitude);
      }
    }

    if (isNaN(lat) || isNaN(lng)) {
      minZoomMap.set(feature, 14);
      continue;
    }

    let minZ = 15; // Default: só aparece no zoom >= 15 se a célula estiver ocupada em todos os zooms anteriores

    for (let z = 8; z <= 14; z++) {
      // Tamanho da célula em graus Decimais (~0.80° no zoom 8 até ~0.012° no zoom 14)
      const cellSize = 0.80 / Math.pow(2, z - 8);
      const gridX = Math.floor(lng / cellSize);
      const gridY = Math.floor(lat / cellSize);
      const key = `${gridX},${gridY}`;

      if (!gridOccupied[z].has(key)) {
        gridOccupied[z].add(key);
        minZ = z;
        break; // Encontrou célula disponível neste nível de zoom!
      }
    }

    minZoomMap.set(feature, minZ);
  }

  return minZoomMap;
};

// Cálculo inteligente de amostragem espacial para coordenadas plotadas (CNEFE / Busca por Tipo / Hospitais)
// Distribui os pontos espacialmente para evitar sobreposição e travamento do mapa
const computeSpatialMinZoomsForCoords = (coords: Array<{ lat: number; lng: number }>): number[] => {
  if (coords.length <= 15) {
    return coords.map(() => 7);
  }

  const gridOccupied: Record<number, Set<string>> = {
    8: new Set(),
    9: new Set(),
    10: new Set(),
    11: new Set(),
    12: new Set(),
    13: new Set(),
    14: new Set(),
  };

  return coords.map(coord => {
    const lat = Number(coord.lat);
    const lng = Number(coord.lng);
    if (isNaN(lat) || isNaN(lng)) return 14;

    for (let z = 8; z <= 14; z++) {
      const cellSize = 0.50 / Math.pow(2, z - 8);
      const gridX = Math.floor(lng / cellSize);
      const gridY = Math.floor(lat / cellSize);
      const key = `${gridX},${gridY}`;

      if (!gridOccupied[z].has(key)) {
        gridOccupied[z].add(key);
        return z;
      }
    }
    return 15;
  });
};

const getAppleMapsPoiIconSvg = (name: string, isSelected: boolean = false) => {
  const n = (name || '').toLowerCase();
  const fill = '#ffffff'; // Branco puro com alto contraste sobre o pino vermelho Apple
  const size = isSelected ? 22 : 12;

  // Se o nome remeter a estádio, arena, clube militar, esporte (ex: "Círculo Militar de Teresina"):
  if (
    n.includes('militar') || 
    n.includes('circulo') || 
    n.includes('círculo') || 
    n.includes('estadio') || 
    n.includes('estádio') || 
    n.includes('arena') || 
    n.includes('clube') || 
    n.includes('campo') || 
    n.includes('esporte')
  ) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
        <line x1="7" y1="3" x2="11" y2="3" stroke="${fill}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="8" y1="3" x2="8" y2="7.5" stroke="${fill}" stroke-width="1.2" />
        <line x1="10" y1="3" x2="10" y2="7.5" stroke="${fill}" stroke-width="1.2" />
        <line x1="13" y1="3" x2="17" y2="3" stroke="${fill}" stroke-width="1.6" stroke-linecap="round" />
        <line x1="14" y1="3" x2="14" y2="7.5" stroke="${fill}" stroke-width="1.2" />
        <line x1="16" y1="3" x2="16" y2="7.5" stroke="${fill}" stroke-width="1.2" />
        <ellipse cx="12" cy="11.5" rx="7.5" ry="3.8" fill="none" stroke="${fill}" stroke-width="1.7" />
        <line x1="6.5" y1="11.5" x2="17.5" y2="11.5" stroke="${fill}" stroke-width="0.9" />
        <line x1="12" y1="8.2" x2="12" y2="14.8" stroke="${fill}" stroke-width="0.9" />
        <path d="M 4.5 11.5 v 2.8 c 0 2.2 3.4 3.8 7.5 3.8 s 7.5 -1.6 7.5 -3.8 v -2.8" fill="${fill}" fill-opacity="0.25" stroke="${fill}" stroke-width="1.6" />
        <path d="M 10.5 18.1 v -2.2 a 1.5 1.5 0 0 1 3 0 v 2.2" fill="${fill}" />
      </svg>
    `;
  }

  // Se for igreja, capela, santuário, catedral:
  if (n.includes('igreja') || n.includes('capela') || n.includes('santuario') || n.includes('santuário') || n.includes('catedral')) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 2h2v3h3v2h-3v3h-2V7H8V5h3V2z"/>
        <path d="M12 11L4 16v6h16v-6l-8-5zm-2 9v-3a2 2 0 0 1 4 0v3h-4z"/>
      </svg>
    `;
  }

  // Se for escola, colégio, universidade, faculdade:
  if (n.includes('escola') || n.includes('colegio') || n.includes('colégio') || n.includes('faculdade') || n.includes('ensino')) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 8.7L4.5 9 12 4.9 19.5 9 12 11.7zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
      </svg>
    `;
  }

  // Se for posto de saúde, hospital, UBS:
  if (n.includes('posto') || n.includes('saude') || n.includes('saúde') || n.includes('ubs') || n.includes('hospital')) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19v-3z"/>
      </svg>
    `;
  }

  // Ícone padrão de Localidade / Povoado / Marco Cívico Apple Maps:
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;
};

const createAppleMapsLocalidadeIcon = (
  name: string,
  zoom: number,
  isSelected: boolean = false,
  customColor?: string
) => {
  const dotColor = (!customColor || customColor === '#34C759' || customColor === '#dc2626') ? '#FF3B30' : customColor;
  const formattedName = toTitleCase(name);
  const safeName = String(formattedName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const iconSvg = getAppleMapsPoiIconSvg(name, isSelected);

  if (isSelected) {
    // Estado Selecionado (Image 2): Balão Apple Maps grande com ponta, anchor dot na coordenada e animação "mechendo"
    return L.divIcon({
      className: 'apple-maps-selected-marker-wrapper',
      iconSize: [44, 56],
      iconAnchor: [22, 50], // Centro exato do anchor dot na coordenada geográfica
      popupAnchor: [0, -56],
      html: `
        <div class="apple-pin-container is-selected">
          <div class="apple-anchor-pulse"></div>
          <div class="apple-anchor-dot"></div>
          <div class="apple-balloon-body">
            <svg class="apple-balloon-svg" viewBox="0 0 44 46" width="44" height="46" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="appleRedGradSel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#ff7b72" />
                  <stop offset="45%" stop-color="${dotColor}" />
                  <stop offset="100%" stop-color="#c92a2a" />
                </linearGradient>
                <filter id="applePinShadowSel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')}" x="-20%" y="-10%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#000000" flood-opacity="0.5" />
                </filter>
              </defs>
              <path 
                d="M 22 43.5 
                   C 20.2 38.5, 5 30, 5 19.5 
                   A 17 17 0 1 1 39 19.5 
                   C 39 30, 23.8 38.5, 22 43.5 Z" 
                fill="url(#appleRedGradSel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')})" 
                stroke="#ffffff" 
                stroke-width="2.5" 
                stroke-linejoin="round"
                filter="url(#applePinShadowSel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')})"
              />
            </svg>
            <div class="apple-balloon-icon">
              ${iconSvg}
            </div>
          </div>
          <div class="apple-selected-label">
            ${safeName}
          </div>
        </div>
      `
    });
  }

  // Estado Normal / Não Apertado (Image 1): Círculo pequeno com ícone + nome à direita
  const fontSize = zoom <= 9 ? '11px' : zoom <= 11 ? '11.5px' : '12.5px';

  return L.divIcon({
    className: 'apple-maps-unselected-marker-wrapper',
    iconSize: [22, 22],
    iconAnchor: [11, 11], // Centro do círculo
    popupAnchor: [0, -14],
    html: `
      <div class="apple-pin-container is-unselected">
        <div class="apple-unselected-badge">
          <svg class="apple-badge-svg" viewBox="0 0 22 22" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="appleRedGradUnsel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ff7b72" />
                <stop offset="50%" stop-color="${dotColor}" />
                <stop offset="100%" stop-color="#c92a2a" />
              </linearGradient>
            </defs>
            <circle cx="11" cy="11" r="9.5" fill="url(#appleRedGradUnsel_${safeName.replace(/[^a-zA-Z0-9]/g, '_')})" stroke="#ffffff" stroke-width="2" />
          </svg>
          <div class="apple-badge-icon">
            ${iconSvg}
          </div>
        </div>
        <span class="apple-unselected-label" style="font-size: ${fontSize};">
          ${safeName}
        </span>
      </div>
    `
  });
};

const createGoogleMapsLabelIcon = createAppleMapsLocalidadeIcon;

interface LabelBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const isOverlapping = (b1: LabelBox, b2: LabelBox, margin: number): boolean => {
  return !(
    b1.maxX + margin < b2.minX ||
    b1.minX - margin > b2.maxX ||
    b1.maxY + margin < b2.minY ||
    b1.minY - margin > b2.maxY
  );
};

const getLocalidadeFeatureKey = (props: any, latLng?: any): string => {
  if (props) {
    const idVal = props.id_Localidades ?? props.id_localidades ?? props.ID ?? props.id ?? props.CD_LOCALIDADE;
    if (idVal !== undefined && idVal !== null && idVal !== '') {
      return `id_${idVal}`;
    }
  }
  if (latLng) {
    const lat = typeof latLng.lat === 'number' ? latLng.lat : (typeof latLng.lat === 'function' ? latLng.lat() : 0);
    const lng = typeof latLng.lng === 'number' ? latLng.lng : (typeof latLng.lng === 'function' ? latLng.lng() : 0);
    return `coord_${lat.toFixed(5)}_${lng.toFixed(5)}`;
  }
  return '';
};

const updateLocalidadesViewport = (
  layer: any,
  map: L.Map,
  selectedFeatures: SelectedFeature[],
  customColor: string
) => {
  if (!layer || !layer.allMarkers || !map || !(map as any)._panes || map.getSize().x === 0) return;
  const currentZoom = map.getZoom();

  // Se o zoom for muito distante (< 8), limpa para não empilhar nomes sobre o mapa do estado inteiro
  if (currentZoom < 8) {
    layer.clearLayers();
    return;
  }

  // Conjunto estrito de marcadores e chaves únicas selecionadas (nunca por nome compartilhado)
  const selectedLocKeys = new Set<string>();
  const selectedLocMarkers = new Set<any>();
  if (selectedFeatures && selectedFeatures.length > 0) {
    for (const f of selectedFeatures) {
      if (f.sourceName === "Localidades (Piauí)") {
        if (f.layer) selectedLocMarkers.add(f.layer);
        const k = (f.layer as any)?.localidadeKey || getLocalidadeFeatureKey(f.properties, (f.layer as any)?.featureLatLng);
        if (k) selectedLocKeys.add(k);
      }
    }
  }

  // Limites visíveis da tela do usuário com margem leve
  const bounds = map.getBounds().pad(0.1);
  const allMarkers = layer.allMarkers as any[];

  layer.clearLayers();

  const placedBoxes: LabelBox[] = [];
  const charWidth = currentZoom <= 9 ? 8 : currentZoom <= 11 ? 8.5 : 9;
  const margin = currentZoom <= 8 ? 36 : currentZoom <= 9 ? 28 : currentZoom <= 10 ? 22 : currentZoom <= 11 ? 16 : currentZoom <= 12 ? 10 : 6;

  // Limite seguro e progressivo por nível de zoom
  const maxVisibleInViewport = currentZoom >= 14 ? 200 : currentZoom >= 13 ? 120 : currentZoom >= 11 ? 60 : currentZoom >= 10 ? 30 : currentZoom >= 9 ? 18 : 8;
  let count = 0;

  for (let i = 0; i < allMarkers.length; i++) {
    const marker = allMarkers[i];
    const latLng = marker.featureLatLng;

    // Apenas elementos DENTRO da área de visão atual no zoom do usuário
    if (latLng && bounds.contains(latLng)) {
      const markerKey = marker.localidadeKey || getLocalidadeFeatureKey(marker.featureProps, marker.featureLatLng);
      const isSelected = selectedLocMarkers.has(marker) || (markerKey ? selectedLocKeys.has(markerKey) : false);
      const passesZoom = currentZoom >= marker.minZoom;

      if (passesZoom || isSelected) {
        // Calcular posição do rótulo na tela em pixels para detecção precisa de colisão
        const pt = map.latLngToContainerPoint(latLng);
        const nameLen = (marker.featureName || '').length;
        const textWidth = nameLen * charWidth + 24;

        // Bounding box rigoroso cobrindo o pin e o texto
        const box: LabelBox = isSelected
          ? {
              minX: pt.x - 24,
              minY: pt.y - 56,
              maxX: pt.x + 24,
              maxY: pt.y + 36,
            }
          : {
              minX: pt.x - 14,
              minY: pt.y - 14,
              maxX: pt.x + 14 + textWidth,
              maxY: pt.y + 14,
            };

        // Evita colisão/sobreposição de texto se o rótulo não for explicitamente selecionado
        if (!isSelected) {
          let hasCollision = false;
          for (let j = 0; j < placedBoxes.length; j++) {
            if (isOverlapping(box, placedBoxes[j], margin)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) {
            continue; // Pula este rótulo para não sobrepor outro existente na tela
          }
        }

        if (typeof marker.setIcon === 'function') {
          marker.setIcon(createAppleMapsLocalidadeIcon(marker.featureName, currentZoom, isSelected, customColor));
        }
        if (isSelected && typeof marker.setZIndexOffset === 'function') {
          marker.setZIndexOffset(100000);
        } else if (typeof marker.setZIndexOffset === 'function') {
          marker.setZIndexOffset(0);
        }

        layer.addLayer(marker);
        placedBoxes.push(box);
        count++;

        if (count >= maxVisibleInViewport) break;
      }
    }
  }
};

interface MapComponentProps {
  isPrintMode?: boolean;
  isMultiSelectMode: boolean;
  selectedFeatures: SelectedFeature[];
  onSelectionChange: (features: SelectedFeature[] | ((prev: SelectedFeature[]) => SelectedFeature[])) => void;
  showToast: (msg: string) => void;
  statusText: string;
  setStatusText: (text: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  activeLayers: string[];
  setActiveLayers: (layers: string[]) => void;
  setMapInstance: (map: L.Map | null) => void;
  registerMapActions: (actions: {
    loadLayerByName: (name: string) => Promise<L.GeoJSON>;
    searchLayerByName?: (name: string, anchor: string, num: string | null, localities: string[]) => Promise<L.GeoJSON>;
    zoomToFeature: (layer: L.Layer) => void;
    selectFeature: (layer: L.Layer, feature: any, sourceName: string) => void;
    removeMeasurePoint: (index: number) => void;
  }) => void;
  searchCoordinates: Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean; origem?: string; rawAddress?: any }> | null;
  onPlottedPointClick?: (index: number, point: any, marker: L.Marker) => void;
  onToggleMultiSelect: () => void;
  onMeasureChange?: (latlngs: L.LatLng[] | null) => void;
  measureHistory?: L.LatLng[] | null;
  onSearchCoordinate?: (coordStr: string) => void;
  allowedLayerNames?: string[];
  allowMeasureTool?: boolean;
  allowLayerPanel?: boolean;
  onSearchPolygonAddresses?: (feat: { feature: any; title: string; sourceName: string; layer: any }) => void;
  onSaveFavoriteLayers?: () => void;
  onLoadFavoriteLayers?: () => void;
  isBottomBarOpen?: boolean;
  isBottomBarExpanded?: boolean;
  isBottomBarMaximized?: boolean;
  isStage2Open?: boolean;
  isSidebarCollapsed?: boolean;
}

// Montagem padronizada do polígono medido com anel fechado e propriedades
const buildMeasuredPolygonFeature = (measureInfo: { points: any[]; areaDisplay?: string; lengthDisplay?: string } | null) => {
  if (!measureInfo || !measureInfo.points || measureInfo.points.length < 3) return null;
  const rawCoords = measureInfo.points.map((p: any) => [
    Number(p.lng !== undefined ? p.lng : (p[1] !== undefined ? p[1] : p[0])),
    Number(p.lat !== undefined ? p.lat : (p[0] !== undefined ? p[0] : p[1]))
  ]);
  if (
    rawCoords[0][0] !== rawCoords[rawCoords.length - 1][0] || 
    rawCoords[0][1] !== rawCoords[rawCoords.length - 1][1]
  ) {
    rawCoords.push([rawCoords[0][0], rawCoords[0][1]]);
  }
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [rawCoords]
    },
    properties: {
      Nome: 'Área Medida',
      Area: measureInfo.areaDisplay || '',
      Perimetro: measureInfo.lengthDisplay || '',
      sourceName: 'Medição'
    }
  };
};

const getMeasureExportFilename = (ext: string) => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `area_medida_${y}${m}${d}_${hh}${mm}.${ext}`;
};

export const MapComponent: React.FC<MapComponentProps> = ({
  isPrintMode,
  isMultiSelectMode,
  selectedFeatures,
  onSelectionChange,
  onPlottedPointClick,
  showToast,
  statusText,
  setStatusText,
  isLoading,
  setIsLoading,
  activeLayers,
  setActiveLayers,
  setMapInstance,
  registerMapActions,
  searchCoordinates,
  onToggleMultiSelect,
  onMeasureChange,
  measureHistory,
  onSearchCoordinate,
  allowedLayerNames,
  allowMeasureTool = true,
  allowLayerPanel = true,
  onSearchPolygonAddresses,
  onSaveFavoriteLayers,
  onLoadFavoriteLayers,
  isBottomBarOpen = true,
  isBottomBarExpanded = false,
  isBottomBarMaximized = false,
  isStage2Open = false,
  isSidebarCollapsed = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lastMeasureModelRef = useRef<any>(null);
  const onSearchPolygonAddressesRef = useRef(onSearchPolygonAddresses);
  const selectedFeaturesRef = useRef<SelectedFeature[]>(selectedFeatures);

  useEffect(() => {
    selectedFeaturesRef.current = selectedFeatures;
  }, [selectedFeatures]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const [activeMeasureInfo, setActiveMeasureInfo] = useState<{
    layer: any;
    areaDisplay?: string;
    lengthDisplay?: string;
    points: any[];
  } | null>(null);

  const handleClearMeasurement = useCallback(() => {
    if (activeMeasureInfo?.layer) {
      try {
        if (mapRef.current) {
          mapRef.current.removeLayer(activeMeasureInfo.layer);
        }
        if ((mapRef.current as any)?.measureControl?._layer) {
          (mapRef.current as any).measureControl._layer.removeLayer(activeMeasureInfo.layer);
        }
      } catch (err) {
        console.error("Erro ao remover medição:", err);
      }
    }
    setActiveMeasureInfo(null);
    lastMeasureModelRef.current = null;
    setIsMeasuringActive(false);
    setMeasureCardPos(null);
    setIsMeasureCardMinimized(false);
    setIsExportMenuOpen(false);
    showToast('🗑️ Medição removida do mapa.');
  }, [activeMeasureInfo, showToast]);

  // Estados e controle do card flutuante de resultado de medição
  const [measureCardPos, setMeasureCardPos] = useState<{ x: number; y: number } | null>(null);
  const [isMeasureCardMinimized, setIsMeasureCardMinimized] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const measureCardRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const isDraggingCardRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialCardX: number; initialCardY: number }>({
    startX: 0,
    startY: 0,
    initialCardX: 0,
    initialCardY: 0
  });

  // Auto-minimizar quando a segunda barra lateral abrir
  const prevStage2OpenRef = useRef<boolean>(isStage2Open);
  useEffect(() => {
    if (!prevStage2OpenRef.current && isStage2Open) {
      setIsMeasureCardMinimized(true);
    }
    prevStage2OpenRef.current = isStage2Open;
  }, [isStage2Open]);

  // Fechar menu de exportação em clique fora ou Escape
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen]);

  // Exportar medição em GeoJSON, KML ou CSV
  const handleExportMeasure = useCallback((format: 'geojson' | 'kml' | 'csv') => {
    if (!activeMeasureInfo) return;
    const feat = buildMeasuredPolygonFeature(activeMeasureInfo);
    if (!feat) {
      showToast('Não foi possível gerar a geometria do polígono medido.');
      return;
    }
    try {
      const filename = getMeasureExportFilename(format);
      if (format === 'geojson') {
        const fc = {
          type: 'FeatureCollection',
          features: [feat]
        };
        downloadFile(filename, JSON.stringify(fc, null, 2), 'application/geo+json;charset=utf-8');
        showToast(`Polígono exportado em GeoJSON (${filename})`);
      } else if (format === 'kml') {
        exportSelectionToKML(filename, [{ feature: feat }]);
        showToast(`Polígono exportado em KML (${filename})`);
      } else if (format === 'csv') {
        exportSelectionToCSV(filename, [{ feature: feat }]);
        showToast(`Polígono exportado em CSV (${filename})`);
      }
    } catch (err) {
      console.error('Erro ao exportar polígono medido:', err);
      showToast('Erro ao exportar polígono medido.');
    } finally {
      setIsExportMenuOpen(false);
    }
  }, [activeMeasureInfo, showToast]);

  // Manipulação de arrasto (mouse e touch) do card
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if ('button' in e && e.button !== 0) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const cardEl = measureCardRef.current;
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();

    isDraggingCardRef.current = true;
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialCardX: rect.left,
      initialCardY: rect.top
    };

    const onPointerMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isDraggingCardRef.current) return;
      moveEvent.stopPropagation();
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const deltaX = currentX - dragStartRef.current.startX;
      const deltaY = currentY - dragStartRef.current.startY;

      const cardWidth = cardEl.offsetWidth || 320;
      const cardHeight = cardEl.offsetHeight || 50;

      const maxX = window.innerWidth - cardWidth - 12;
      const maxY = window.innerHeight - cardHeight - 12;

      const clampedX = Math.max(12, Math.min(maxX, dragStartRef.current.initialCardX + deltaX));
      const clampedY = Math.max(12, Math.min(maxY, dragStartRef.current.initialCardY + deltaY));

      setMeasureCardPos({ x: clampedX, y: clampedY });
    };

    const onPointerUp = (upEvent: MouseEvent | TouchEvent) => {
      isDraggingCardRef.current = false;
      upEvent.stopPropagation();
      window.removeEventListener('mousemove', onPointerMove, true);
      window.removeEventListener('mouseup', onPointerUp, true);
      window.removeEventListener('touchmove', onPointerMove, true);
      window.removeEventListener('touchend', onPointerUp, true);
      window.removeEventListener('touchcancel', onPointerUp, true);
    };

    window.addEventListener('mousemove', onPointerMove, { capture: true, passive: false });
    window.addEventListener('mouseup', onPointerUp, { capture: true, passive: false });
    window.addEventListener('touchmove', onPointerMove, { capture: true, passive: false });
    window.addEventListener('touchend', onPointerUp, { capture: true, passive: false });
    window.addEventListener('touchcancel', onPointerUp, { capture: true, passive: false });
  }, []);

  const handleDragHandleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMeasureCardPos(null);
    showToast('Posição padrão do card restaurada.');
  }, [showToast]);

  const [isMeasuringActive, setIsMeasuringActive] = useState<boolean>(false);
  const isMeasuringActiveRef = useRef<boolean>(false);

  useEffect(() => {
    isMeasuringActiveRef.current = isMeasuringActive;
  }, [isMeasuringActive]);

  const measurePoints = measureHistory || [];
  const pointCount = measurePoints.length;

  const handleToggleMeasure = useCallback(() => {
    if (!mapRef.current) return;
    const measureControl = (mapRef.current as any).measureControl;
    
    if (isMeasuringActive) {
      if (measureControl) {
        if (measurePoints && measurePoints.length >= 2 && typeof measureControl._handleMeasureDoubleClick === 'function') {
          if (!measureControl._latlngs || measureControl._latlngs.length < measurePoints.length) {
            measureControl._latlngs = [...measurePoints];
          }
          measureControl._handleMeasureDoubleClick();
          showToast('Medição concluída e traçada no mapa!');
        } else if (typeof measureControl._finishMeasure === 'function') {
          measureControl._finishMeasure();
          showToast('Medição encerrada.');
        }
      }
      setIsMeasuringActive(false);
    } else {
      if (measureControl && typeof measureControl._startMeasure === 'function') {
        measureControl._startMeasure();
      }
      setIsMeasuringActive(true);
      showToast('📏 Modo Medição ativado! Toque no mapa para marcar pontos.');
    }
  }, [isMeasuringActive, measurePoints, showToast]);

  const handleCancelMeasure = useCallback(() => {
    if (mapRef.current && (mapRef.current as any).measureControl) {
      try {
        const mc = (mapRef.current as any).measureControl;
        if (typeof mc._clearMeasure === 'function') {
          mc._clearMeasure();
        }
        if (typeof mc._finishMeasure === 'function') {
          mc._finishMeasure();
        }
      } catch (err) {
        console.error("Erro ao cancelar medição", err);
      }
    }
    setIsMeasuringActive(false);
    if (onMeasureChange) {
      onMeasureChange(null);
    }
    showToast('Medição cancelada.');
  }, [onMeasureChange, showToast]);

  const handleFinishMeasure = useCallback(() => {
    if (mapRef.current && (mapRef.current as any).measureControl) {
      const mc = (mapRef.current as any).measureControl;
      try {
        if (typeof mc._handleMeasureDoubleClick === 'function') {
          if (measurePoints && measurePoints.length >= 2 && (!mc._latlngs || mc._latlngs.length < measurePoints.length)) {
            mc._latlngs = [...measurePoints];
          }
          mc._handleMeasureDoubleClick();
        } else if (typeof mc._finishMeasure === 'function') {
          mc._finishMeasure();
        }
      } catch (err) {
        console.error("Erro ao finalizar medição", err);
      }
    }
    setIsMeasuringActive(false);
    showToast('Medição concluída e traçada no mapa!');
  }, [measurePoints, showToast]);

  const handleRemoveMeasurePoint = useCallback((index: number) => {
    if (mapRef.current && (mapRef.current as any).measureControl) {
      (mapRef.current as any).measureControl.removePoint(index);
    }
  }, []);

  const totalDistanceMeters = useMemo(() => {
    if (pointCount < 2) return 0;
    let d = 0;
    for (let i = 0; i < pointCount - 1; i++) {
      d += haversineDistanceMeters(
        measurePoints[i].lat,
        measurePoints[i].lng,
        measurePoints[i + 1].lat,
        measurePoints[i + 1].lng
      );
    }
    return d;
  }, [measurePoints, pointCount]);

  const totalAreaSqMeters = useMemo(() => {
    if (pointCount < 3) return 0;
    return calculateGeodesicAreaMeters(measurePoints);
  }, [measurePoints, pointCount]);

  useEffect(() => {
    onSearchPolygonAddressesRef.current = onSearchPolygonAddresses;
  }, [onSearchPolygonAddresses]);
  
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (isPrintMode) {
      // Small delay to ensure the DOM has rendered the portal target from App.tsx
      const timeout = setTimeout(() => {
        setPortalTarget(document.getElementById('print-map-controls-portal'));
      }, 0);
      return () => clearTimeout(timeout);
    } else {
      setPortalTarget(null);
    }
  }, [isPrintMode]);

  useEffect(() => {
    if (mapRef.current) {
      const forceRedraw = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ pan: false });
        }
      };
      
      forceRedraw();
      // Em alguns casos de flexbox, o tamanho demora alguns frames para estabilizar
      const t1 = setTimeout(forceRedraw, 50);
      const t2 = setTimeout(forceRedraw, 200);
      const t3 = setTimeout(forceRedraw, 500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [isPrintMode]);
  
  // Ref para sincronizar o modo de multiseleção dinamicamente nos event listeners das camadas
  const isMultiSelectModeRef = useRef<boolean>(isMultiSelectMode);
  useEffect(() => {
    isMultiSelectModeRef.current = isMultiSelectMode;
  }, [isMultiSelectMode]);

  // Cache de camadas carregadas para evitar novos fetches
  const loadedLayersRef = useRef<Record<string, L.GeoJSON>>({});
  
  // Estados para UI do Mapa (Padrão Apple Maps / maps.apple.com)
  const [basemap, setBasemap] = useState<string>(() => {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
      return 'appleDark';
    }
    return 'apple';
  });
  const [basemapModalOpen, setBasemapModalOpen] = useState<boolean>(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState<boolean>(false);

  // Sincronização inteligente entre Apple Maps Claro e Escuro ao alternar tema do site
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setBasemap(prev => {
        if (isDark && prev === 'apple') return 'appleDark';
        if (!isDark && prev === 'appleDark') return 'apple';
        return prev;
      });
    };
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fechar o painel de camadas automaticamente se a permissão for desativada
  useEffect(() => {
    if (allowLayerPanel === false && layersPanelOpen) {
      setLayersPanelOpen(false);
    }
  }, [allowLayerPanel, layersPanelOpen]);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    activeLayers.forEach(name => {
      initial[name] = true;
    });
    return initial;
  });

  const [layerOpacities, setLayerOpacities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    dataSources.forEach(s => {
      if (s.name === "Localidades (Piauí)") {
        initial[s.name] = 0.5;
      } else if (s.name === "Municipios") {
        initial[s.name] = 0;
      } else {
        initial[s.name] = 0.1;
      }
    });
    return initial;
  });
  const [layerColorsState, setLayerColorsState] = useState<Record<string, string>>({});
  const layerColorsRef = useRef<Record<string, string>>({});
  const [layerStrokeColorsState, setLayerStrokeColorsState] = useState<Record<string, string>>({});
  const layerStrokeColorsRef = useRef<Record<string, string>>({});

  // Estado de visibilidade individual das camadas presentes nas camadas ativas (true = visível no mapa, false = desativada temporariamente)
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({});

  // Refs para gerenciar o Balão Callout e a Linha Conectora (Haste) das Camadas de Polígonos
  const polygonCalloutLineRef = useRef<L.Polyline | null>(null);
  const polygonCalloutMarkerRef = useRef<L.CircleMarker | null>(null);
  const polygonCalloutPopupRef = useRef<L.Popup | null>(null);

  // Limpar balão callout, linha conectora e âncora de polígonos
  const clearPolygonCallout = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (polygonCalloutLineRef.current && map.hasLayer(polygonCalloutLineRef.current)) {
      map.removeLayer(polygonCalloutLineRef.current);
      polygonCalloutLineRef.current = null;
    }
    if (polygonCalloutMarkerRef.current && map.hasLayer(polygonCalloutMarkerRef.current)) {
      map.removeLayer(polygonCalloutMarkerRef.current);
      polygonCalloutMarkerRef.current = null;
    }
    if (polygonCalloutPopupRef.current && map.hasLayer(polygonCalloutPopupRef.current)) {
      map.removeLayer(polygonCalloutPopupRef.current);
      polygonCalloutPopupRef.current = null;
    }
  }, []);

  // Obter todas as coordenadas de um polígono / multipolígono
  const getAllPolygonCoordinates = (layer: any): L.LatLng[] => {
    const coords: L.LatLng[] = [];
    if (typeof layer.getLatLngs === 'function') {
      const latlngs = layer.getLatLngs();
      const extract = (arr: any) => {
        if (!arr) return;
        if (arr instanceof L.LatLng) {
          coords.push(arr);
        } else if (typeof arr === 'object' && typeof arr.lat === 'number' && typeof arr.lng === 'number') {
          coords.push(L.latLng(arr.lat, arr.lng));
        } else if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            extract(arr[i]);
          }
        }
      };
      extract(latlngs);
    }
    return coords;
  };

  // Encontrar o ponto de ancoragem perfeitamente localizado NA BORDA do polígono (lado esquerdo ou direito)
  const getPolygonBorderAnchor = (layer: any, map: L.Map, side: 'left' | 'right' = 'left', targetLatLng?: L.LatLng): L.LatLng => {
    if (typeof layer.getBounds === 'function' && layer.getBounds().isValid()) {
      const b = layer.getBounds();
      const coords = getAllPolygonCoordinates(layer);
      const refLat = targetLatLng ? targetLatLng.lat : (b.getNorth() + b.getSouth()) / 2;

      if (coords.length > 0) {
        let bestPt = coords[0];
        let bestScore = Infinity;
        const targetLng = side === 'left' ? b.getWest() : b.getEast();

        for (const pt of coords) {
          const lngDiff = Math.abs(pt.lng - targetLng) * 2;
          const latDiff = Math.abs(pt.lat - refLat);
          const score = lngDiff + latDiff;
          if (score < bestScore) {
            bestScore = score;
            bestPt = pt;
          }
        }
        return bestPt;
      }

      return side === 'left' 
        ? L.latLng(refLat, b.getWest())
        : L.latLng(refLat, b.getEast());
    }

    if (typeof (layer as any).getLatLng === 'function') {
      return (layer as any).getLatLng();
    }

    return targetLatLng || map.getCenter();
  };

  // Abrir Balão Callout Lateral com Linha Conectora a partir da BORDA do Polígono até o CANTO do Popup
  const openPolygonCallout = useCallback((layer: L.Layer, htmlContent: string, clickLatLng?: L.LatLng, fitPolygon: boolean = false) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    clearPolygonCallout();

    // 1. Dar zoom / enquadrar a feição com margem ampla no lado esquerdo (280px) para acomodar o popup de 240px + linha de 45px
    if (fitPolygon && typeof (layer as any).getBounds === 'function' && (layer as any).getBounds().isValid()) {
      const bounds = (layer as any).getBounds();
      map.fitBounds(bounds, {
        paddingTopLeft: L.point(280, 50),
        paddingBottomRight: L.point(50, 50),
        maxZoom: 15,
        animate: true,
        duration: 0.3
      });
    }

    // 2. Renderizar o Balão Callout e Linha Conectora
    const renderCallout = () => {
      if (!mapRef.current) return;

      // Limpar linha e marcador anteriores se houver
      if (polygonCalloutLineRef.current && map.hasLayer(polygonCalloutLineRef.current)) {
        map.removeLayer(polygonCalloutLineRef.current);
        polygonCalloutLineRef.current = null;
      }
      if (polygonCalloutMarkerRef.current && map.hasLayer(polygonCalloutMarkerRef.current)) {
        map.removeLayer(polygonCalloutMarkerRef.current);
        polygonCalloutMarkerRef.current = null;
      }

      // Determinar ancoragem na borda do polígono
      let side: 'left' | 'right' = 'left';
      let anchorLatLng = getPolygonBorderAnchor(layer, map, 'left', clickLatLng);
      let anchorPt = map.latLngToContainerPoint(anchorLatLng);

      // Se não houver pelo menos 300px livres à esquerda da feição, posiciona à direita
      if (anchorPt.x < 300) {
        side = 'right';
        anchorLatLng = getPolygonBorderAnchor(layer, map, 'right', clickLatLng);
        anchorPt = map.latLngToContainerPoint(anchorLatLng);
      }

      // Largura estimada do popup = 240px (metade = 120px). Distância da linha conectora = 45px.
      const lineDistance = 45;
      const popupHalfWidth = 120;

      // Ponto no CANTO do Popup onde a linha tracejada se conecta:
      // Se side === 'left': o canto inferior direito do popup fica em (anchorPt.x - lineDistance, anchorPt.y)
      // Se side === 'right': o canto inferior esquerdo do popup fica em (anchorPt.x + lineDistance, anchorPt.y)
      const popupCornerPt = L.point(
        side === 'left' ? anchorPt.x - lineDistance : anchorPt.x + lineDistance,
        anchorPt.y
      );
      const popupCornerLatLng = map.containerPointToLatLng(popupCornerPt);

      // O centro do popup (onde o Leaflet ancora o balão para que o canto fique no final da linha):
      const popupCenterPt = L.point(
        side === 'left' ? popupCornerPt.x - popupHalfWidth : popupCornerPt.x + popupHalfWidth,
        popupCornerPt.y
      );
      const popupCenterLatLng = map.containerPointToLatLng(popupCenterPt);

      // 1. Popup posicionado no centro calculado (fica 100% fora do polígono, sem sobrepor)
      if (!polygonCalloutPopupRef.current || !map.hasLayer(polygonCalloutPopupRef.current)) {
        const popup = L.popup({
          className: 'polygon-callout-balloon',
          autoPan: false,
          closeOnClick: false,
          offset: L.point(0, 0)
        })
          .setLatLng(popupCenterLatLng)
          .setContent(htmlContent)
          .openOn(map);

        polygonCalloutPopupRef.current = popup;

        popup.on('remove', () => {
          map.off('move', syncLineOnMove);
          map.off('zoom', syncLineOnMove);
          map.off('moveend', syncLineOnMove);
          map.off('zoomend', syncLineOnMove);
          clearPolygonCallout();
        });
      } else {
        polygonCalloutPopupRef.current.setLatLng(popupCenterLatLng);
      }

      // 2. Medir o canto inferior exato do retângulo do popup no DOM
      let exactCornerLatLng = popupCornerLatLng;
      const popupEl = polygonCalloutPopupRef.current?.getElement()?.querySelector('.leaflet-popup-content-wrapper') as HTMLElement;
      if (popupEl) {
        const rect = popupEl.getBoundingClientRect();
        const mapRect = map.getContainer().getBoundingClientRect();
        if (side === 'left') {
          // Canto inferior direito do popup
          const cornerContainerPt = L.point(rect.right - mapRect.left, rect.bottom - mapRect.top);
          exactCornerLatLng = map.containerPointToLatLng(cornerContainerPt);
        } else {
          // Canto inferior esquerdo do popup
          const cornerContainerPt = L.point(rect.left - mapRect.left, rect.bottom - mapRect.top);
          exactCornerLatLng = map.containerPointToLatLng(cornerContainerPt);
        }
      }

      // 3. Linha conectora elegante e tracejada (da BORDA da feição até o CANTO INFERIOR do balão estilo Apple)
      const connectorLine = L.polyline([anchorLatLng, exactCornerLatLng], {
        color: '#007AFF',
        weight: 2.5,
        dashArray: '5, 5',
        opacity: 0.95,
        className: 'polygon-callout-connector'
      }).addTo(map);
      polygonCalloutLineRef.current = connectorLine;

      // 4. Marcador âncora exatamente NA BORDA da feição (Apple Blue)
      const anchorMarker = L.circleMarker(anchorLatLng, {
        radius: 4.5,
        fillColor: '#007AFF',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
        className: 'polygon-callout-anchor'
      }).addTo(map);
      polygonCalloutMarkerRef.current = anchorMarker;

      // 5. Ajuste fino de frame para garantir ancoragem milimétrica no canto após montagem no DOM
      requestAnimationFrame(() => {
        if (!mapRef.current || !polygonCalloutLineRef.current || !polygonCalloutPopupRef.current) return;
        const el = polygonCalloutPopupRef.current.getElement()?.querySelector('.leaflet-popup-content-wrapper') as HTMLElement;
        if (el) {
          const r = el.getBoundingClientRect();
          const mr = map.getContainer().getBoundingClientRect();
          const cPt = side === 'left' 
            ? L.point(r.right - mr.left, r.bottom - mr.top)
            : L.point(r.left - mr.left, r.bottom - mr.top);
          const cLatLng = map.containerPointToLatLng(cPt);
          polygonCalloutLineRef.current.setLatLngs([anchorLatLng, cLatLng]);
        }
      });
    };

    // Sincronizar linha e âncora em tempo real se o mapa mover ou der zoom
    const syncLineOnMove = () => {
      if (polygonCalloutPopupRef.current && polygonCalloutPopupRef.current.isOpen()) {
        renderCallout();
      }
    };

    renderCallout();

    map.on('move', syncLineOnMove);
    map.on('zoom', syncLineOnMove);
    map.on('moveend', syncLineOnMove);
    map.on('zoomend', syncLineOnMove);
  }, [clearPolygonCallout]);

  // Estado da Legenda Cartográfica Interativa do Mapa (Estilo QGIS)
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);

  // Minimizar legenda automaticamente quando a Busca de Endereços Avançado for aberta/expandida,
  // e voltar ao normal (expandida) automaticamente quando a ferramenta de busca for recolhida
  useEffect(() => {
    if (isBottomBarOpen && isBottomBarExpanded) {
      setIsLegendOpen(false);
    } else {
      setIsLegendOpen(true);
    }
  }, [isBottomBarOpen, isBottomBarExpanded]);

  // Mapeamento de contagem de feições visíveis na extensão (viewport) atual do mapa
  const [visibleLayersInViewport, setVisibleLayersInViewport] = useState<Record<string, number>>({});

  // Função ultra-rápida para calcular quais camadas têm feições reais dentro da tela (viewport) visível do mapa
  const updateLegendViewport = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const bounds = map.getBounds();
    if (!bounds || !bounds.isValid()) return;

    const visibleCounts: Record<string, number> = {};

    activeLayers.forEach(layerName => {
      // Ignorar se a camada não estiver permitida
      if (allowedLayerNames && !allowedLayerNames.includes(layerName)) return;

      const layer = loadedLayersRef.current[layerName];
      if (!layer) {
        visibleCounts[layerName] = 0;
        return;
      }

      let count = 0;

      if (layerName === "Localidades (Piauí)") {
        const currentZoom = map.getZoom();
        if (currentZoom < 8) {
          count = 0;
        } else if (typeof layer.getLayers === 'function') {
          // Contagem exata dos marcadores de Localidades realmente renderizados na tela
          count = layer.getLayers().length;
        }
      } else {
        if (typeof layer.eachLayer === 'function') {
          layer.eachLayer((subLayer: any) => {
            if (typeof subLayer.getBounds === 'function') {
              const b = subLayer.getBounds();
              if (b && b.isValid() && bounds.intersects(b)) {
                count++;
              }
            } else if (typeof subLayer.getLatLng === 'function') {
              const pt = subLayer.getLatLng();
              if (pt && bounds.contains(pt)) {
                count++;
              }
            }
          });
        }
      }

      visibleCounts[layerName] = count;
    });

    setVisibleLayersInViewport(visibleCounts);
  }, [activeLayers, allowedLayerNames]);

  // Camadas ativas e visíveis calculadas em tempo real com base no que está presente NO ENQUADRAMENTO DA TELA
  const activeVisibleLayers = useMemo(() => {
    return activeLayers
      .filter(layerName => {
        if (allowedLayerNames && !allowedLayerNames.includes(layerName)) return false;
        return true;
      })
      .map(layerName => {
        const source = dataSources.find(s => s.name === layerName);
        const isPointLayer = layerName === "Localidades (Piauí)";
        const isVisible = visibleLayers[layerName] !== false;
        const customFillColor = layerColorsState[layerName] || (source ? getLayerColor(source.name) : '#dc2626');
        const customStrokeColor = layerStrokeColorsState[layerName] || (source ? getLayerColor(source.name) : customFillColor);
        const opacity = layerOpacities[layerName] ?? (isPointLayer ? 0.5 : (layerName === "Municipios" ? 0 : 0.1));
        const featureCount = visibleLayersInViewport[layerName] ?? 0;

        return {
          name: layerName,
          isPointLayer,
          isVisible,
          fillColor: customFillColor,
          strokeColor: customStrokeColor,
          opacity,
          featureCount,
          source
        };
      });
  }, [activeLayers, visibleLayers, layerColorsState, layerStrokeColorsState, layerOpacities, allowedLayerNames, visibleLayersInViewport]);

  // Mapeamento de feições e camadas por ID do Leaflet para buscas espaciais
  const layerFeatureMapRef = useRef<Record<string, { feature: any; title: string; sourceName: string; layer: any }>>({});

  useEffect(() => {
    (window as any).searchAddressesInPolygonByLayerId = (layerId: string) => {
      const item = layerFeatureMapRef.current[String(layerId)];
      if (item && onSearchPolygonAddresses) {
        onSearchPolygonAddresses(item);
      }
    };
    return () => {
      delete (window as any).searchAddressesInPolygonByLayerId;
    };
  }, [onSearchPolygonAddresses]);

  // Estados para Gestão de até 4 Estilos Personalizados Salvos
  const [savedStyles, setSavedStyles] = useState<SavedStylePreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showLoadDropdown, setShowLoadDropdown] = useState<boolean>(false);
  const [styleNameInput, setStyleNameInput] = useState<string>('');
  const [overwriteStyleId, setOverwriteStyleId] = useState<string | null>(null);

  // Função auxiliar para saber se uma camada está visível no mapa
  const isLayerVisible = (sourceName: string) => {
    return visibleLayers[sourceName] !== false;
  };

  // Estados para Localização do Usuário (GPS)
  const [showUserLocation, setShowUserLocation] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);

  // Alternar Localização do Usuário (Ativar/Desativar GPS)
  const toggleUserLocation = () => {
    if (showUserLocation) {
      setShowUserLocation(false);
      showToast("Localização GPS ocultada.");
    } else {
      setShowUserLocation(true);
      if (userLocation && mapRef.current) {
        mapRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 1.2 });
      }
    }
  };

  // Efeito de Monitoramento da Geolocalização GPS do Usuário
  useEffect(() => {
    if (!showUserLocation) {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      if (mapRef.current) {
        if (userMarkerRef.current) {
          mapRef.current.removeLayer(userMarkerRef.current);
          userMarkerRef.current = null;
        }
        if (userAccuracyCircleRef.current) {
          mapRef.current.removeLayer(userAccuracyCircleRef.current);
          userAccuracyCircleRef.current = null;
        }
      }
      setUserLocation(null);
      return;
    }

    if (!('geolocation' in navigator)) {
      showToast("Geolocalização não é suportada por este navegador.");
      setShowUserLocation(false);
      return;
    }

    setStatusText("Obtendo sua localização GPS...");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setStatusText("Localização GPS atualizada.");

        const map = mapRef.current;
        if (map) {
          // Remover círculo de precisão antigo se existir
          if (userAccuracyCircleRef.current) {
            map.removeLayer(userAccuracyCircleRef.current);
            userAccuracyCircleRef.current = null;
          }

          // Marcador do Usuário: Ponto simples em azul sem aura
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
            userMarkerRef.current.setPopupContent(`
              <div style="padding: 4px; font-family: sans-serif; text-align: center;">
                <div style="font-weight: 800; font-size: 13px; color: #1e40af; margin-bottom: 2px;">📍 Sua Localização Atual</div>
                <div style="font-size: 11px; color: #475569;">${latitude.toFixed(6)}&deg;, ${longitude.toFixed(6)}&deg;</div>
              </div>
            `);
          } else {
            const userIcon = L.divIcon({
              className: 'user-gps-marker-container',
              html: `<div style="width: 12px; height: 12px; border-radius: 9999px; background-color: #2563eb; border: 2px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });

            userMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1200 })
              .bindPopup(`
                <div class="webgis-popup-container" style="text-align: center; align-items: center;">
                  <div class="webgis-popup-badge" style="background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.2); color: #2563eb;">
                    <span class="webgis-popup-dot" style="background-color: #2563eb;"></span>
                    <span>Sua Localização</span>
                  </div>
                  <div style="font-size: 13px; font-weight: 700; color: #0f172a;" class="dark:text-slate-100">GPS Ativo</div>
                  <div class="webgis-popup-attributes-grid" style="width: 100%; text-align: center;">
                    <div style="font-size: 11px; font-weight: 600; color: #475569;" class="dark:text-slate-300">${latitude.toFixed(6)}&deg;, ${longitude.toFixed(6)}&deg;</div>
                  </div>
                </div>
              `)
              .addTo(map);

            map.flyTo([latitude, longitude], 15, { duration: 1.2 });
            showToast("Localização mostrada no mapa!");
          }
        }
      },
      (err) => {
        console.error("Erro na geolocalização:", err);
        showToast("Não foi possível acessar seu GPS. Verifique a permissão do seu navegador.");
        setShowUserLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    watchPositionIdRef.current = watchId;

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
      }
    };
  }, [showUserLocation]);

  // Restaurar estilos salvos do localStorage ao carregar o componente
  useEffect(() => {
    try {
      let stylesList: SavedStylePreset[] = [];
      const savedStylesRaw = localStorage.getItem('webgis_saved_styles');
      if (savedStylesRaw) {
        stylesList = JSON.parse(savedStylesRaw);
      } else {
        // Suporte para migração do estilo antigo único
        const legacyRaw = localStorage.getItem('webgis_saved_map_style');
        if (legacyRaw) {
          const legacyData = JSON.parse(legacyRaw);
          stylesList = [{
            id: 'preset_1',
            name: 'Estilo Salvo 1',
            activeLayers: legacyData.activeLayers || [],
            visibleLayers: legacyData.visibleLayers || {},
            layerOpacities: legacyData.layerOpacities || {},
            layerColorsState: legacyData.layerColorsState || {},
            layerStrokeColorsState: legacyData.layerStrokeColorsState || {},
            basemap: legacyData.basemap || 'googleHybrid',
            savedAt: new Date().toLocaleDateString('pt-BR')
          }];
          localStorage.setItem('webgis_saved_styles', JSON.stringify(stylesList));
        }
      }

      setSavedStyles(stylesList);
      // Auto-load removed to respect hardcoded defaults as requested by user
    } catch (e) {
      console.error('Erro ao restaurar estilo salvo no início:', e);
    }
  }, []);

  // Estado de Arrastar e Soltar (Drag & Drop) para Reordenação de Camadas Ativas
  const [draggedLayer, setDraggedLayer] = useState<string | null>(null);
  const [dragOverLayer, setDragOverLayer] = useState<string | null>(null);

  // Refs para chamadas de callbacks globais a partir de popups nativos do Leaflet
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const onSearchCoordinateRef = useRef(onSearchCoordinate);
  useEffect(() => {
    onSearchCoordinateRef.current = onSearchCoordinate;
  }, [onSearchCoordinate]);

  useEffect(() => {
    (window as any).identifyFeaturesFromCtx = (latStr: string, lngStr: string) => {
      // Fecha o balão do pino de botão direito imediatamente para deixar apenas o pino no mapa
      if (rightClickMarkerRef.current) {
        rightClickMarkerRef.current.closePopup();
      }
      if (onSearchCoordinateRef.current) {
        onSearchCoordinateRef.current(`${latStr}, ${lngStr}`);
      }
    };
    const copyTextSafely = (text: string): boolean => {
      if (!text) return false;
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          navigator.clipboard.writeText(text);
          return true;
        } catch {}
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
          const ok = document.execCommand('copy');
          document.body.removeChild(textArea);
          return ok;
        }
      } catch {}
      return false;
    };

    (window as any).copyCtxCoord = (type: 'all' | 'lat' | 'lng', latStr: string, lngStr: string) => {
      if (type === 'all') {
        copyTextSafely(`${latStr}, ${lngStr}`);
        if (showToastRef.current) showToastRef.current(`Coordenadas copiadas: ${latStr}, ${lngStr}`);
      } else if (type === 'lat') {
        copyTextSafely(latStr);
        if (showToastRef.current) showToastRef.current(`Latitude copiada: ${latStr}`);
      } else {
        copyTextSafely(lngStr);
        if (showToastRef.current) showToastRef.current(`Longitude copiada: ${lngStr}`);
      }
    };

    (window as any).copyPopupEl = (el: HTMLElement, event?: Event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (!el) return;

      // Não aciona cópia se o usuário estiver selecionando texto com o mouse
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      const copyVal = el.getAttribute('data-copy');
      const label = el.getAttribute('data-label') || 'Texto';
      if (!copyVal) return;

      const ok = copyTextSafely(copyVal);
      if (!ok) {
        if (showToastRef.current) showToastRef.current(`Não foi possível copiar ${label}`);
        return;
      }

      if (showToastRef.current) {
        showToastRef.current(`${label} copiado!`);
      }

      // Calcula a origem da onda a partir do ponto clicado
      if (event && 'clientX' in event && 'clientY' in event) {
        const mouseEv = event as MouseEvent;
        const rect = el.getBoundingClientRect();
        const x = mouseEv.clientX - rect.left;
        const y = mouseEv.clientY - rect.top;
        el.style.setProperty('--ripple-x', `${x}px`);
        el.style.setProperty('--ripple-y', `${y}px`);
      } else {
        el.style.setProperty('--ripple-x', '50%');
        el.style.setProperty('--ripple-y', '50%');
      }

      // Ativa classe com animação CSS suave
      el.classList.remove('webgis-copied');
      void el.offsetWidth; // Força reflow para permitir reiniciar caso clicado de novo
      el.classList.add('webgis-copied');

      const existingTimer = (el as any)._webgisCopyTimer;
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      (el as any)._webgisCopyTimer = setTimeout(() => {
        el.classList.remove('webgis-copied');
        (el as any)._webgisCopyTimer = null;
      }, 1200);
    };

    (window as any).handlePopupKeydown = (el: HTMLElement, event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        (window as any).copyPopupEl(el, event);
      }
    };

    (window as any).copyPopupText = (text: string, btnEl?: HTMLElement, feedbackMsg?: string) => {
      if (!text) return;
      copyTextSafely(text);
      if (showToastRef.current && feedbackMsg) {
        showToastRef.current(feedbackMsg);
      }
      if (btnEl) {
        btnEl.classList.remove('webgis-copied');
        void btnEl.offsetWidth;
        btnEl.classList.add('webgis-copied');
        setTimeout(() => {
          btnEl.classList.remove('webgis-copied');
        }, 1200);
      }
    };

    (window as any).copyFullAddressPopup = (fullAddr: string, btnEl?: HTMLElement) => {
      if (!fullAddr) return;
      copyTextSafely(fullAddr);
      if (showToastRef.current) {
        showToastRef.current('Endereço completo copiado!');
      }
      if (btnEl) {
        btnEl.classList.add('webgis-copied');
        setTimeout(() => btnEl.classList.remove('webgis-copied'), 1200);
      }
    };
    (window as any).removeRightClickPin = () => {
      if (rightClickMarkerRef.current && mapRef.current) {
        mapRef.current.removeLayer(rightClickMarkerRef.current);
        rightClickMarkerRef.current = null;
      }
      if (showToastRef.current) {
        showToastRef.current('Pino removido do mapa.');
      }
    };
  }, []);

  // Definição dos Basemaps
  const tileLayersRef = useRef<Record<string, L.TileLayer>>({});
  const searchMarkersRef = useRef<L.Marker[]>([]);
  const allSearchMarkersRef = useRef<any[]>([]);
  const searchLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const selectedPlottedIdRef = useRef<string | null>(null);
  const onPlottedPointClickRef = useRef(onPlottedPointClick);
  useEffect(() => {
    onPlottedPointClickRef.current = onPlottedPointClick;
  }, [onPlottedPointClick]);
  const rightClickMarkerRef = useRef<L.Marker | null>(null);

  // Estilo de seleção destacado estilo Apple Maps (Apple Blue brilhante com contorno animado)
  const selectedStyle: L.PathOptions = { 
    stroke: true,
    weight: 3.5, 
    color: '#007AFF', 
    dashArray: '6, 6', 
    fillOpacity: 0.22,
    opacity: 1,
    className: 'selected-feature-animated-dash'
  };

  // Função auxiliar para aplicar ou remover o estilo com contorno tracejado animado (andando)
  const applySelectedStyleToLayer = (layer: any, isSelected: boolean) => {
    if (!layer) return;

    // Camada de Localidades (Pontos) possui ícone próprio e animação estilo Apple Maps
    if (layer.customSourceName === "Localidades (Piauí)" || (layer as any).featureName) {
      if (typeof layer.setIcon === 'function') {
        const customColor = layerColorsRef.current?.["Localidades (Piauí)"] || '#FF3B30';
        const currentZoom = mapRef.current ? mapRef.current.getZoom() : 11;
        layer.setIcon(createAppleMapsLocalidadeIcon((layer as any).featureName || 'Localidade', currentZoom, isSelected, customColor));
        if (isSelected && typeof layer.setZIndexOffset === 'function') {
          layer.setZIndexOffset(100000);
        } else if (typeof layer.setZIndexOffset === 'function') {
          layer.setZIndexOffset(0);
        }
      }
      return;
    }

    if (layer._icon || (typeof L !== 'undefined' && layer instanceof L.Marker)) {
      return;
    }

    const updateSingle = (l: any) => {
      if (l.customSourceName === "Localidades (Piauí)" || (l as any).featureName) {
        if (typeof l.setIcon === 'function') {
          const customColor = layerColorsRef.current?.["Localidades (Piauí)"] || '#FF3B30';
          const currentZoom = mapRef.current ? mapRef.current.getZoom() : 11;
          l.setIcon(createAppleMapsLocalidadeIcon((l as any).featureName || 'Localidade', currentZoom, isSelected, customColor));
          if (isSelected && typeof l.setZIndexOffset === 'function') {
            l.setZIndexOffset(100000);
          } else if (typeof l.setZIndexOffset === 'function') {
            l.setZIndexOffset(0);
          }
        }
        return;
      }

      if (l._icon || (typeof L !== 'undefined' && l instanceof L.Marker)) {
        return;
      }

      if (isSelected) {
        if (typeof l.setStyle === 'function') {
          l.setStyle(selectedStyle);
        }
        if (typeof l.bringToFront === 'function') {
          l.bringToFront();
        }
        const el = l._path || (typeof l.getElement === 'function' ? l.getElement() : null);
        if (el) {
          el.classList.add('selected-feature-animated-dash');
          el.setAttribute('stroke-dasharray', '6, 6');
        }
      } else {
        if (l.options) {
          l.options.dashArray = '';
          l.options.className = '';
          l.options.stroke = true;
        }
        const resetStyle: L.PathOptions = {
          stroke: true,
          ...(l.defaultStyle || {}),
          dashArray: '',
          className: ''
        };
        if (typeof l.setStyle === 'function') {
          l.setStyle(resetStyle);
        }
        const el = l._path || (typeof l.getElement === 'function' ? l.getElement() : null);
        if (el) {
          el.classList.remove('selected-feature-animated-dash');
          el.removeAttribute('stroke-dasharray');
        }
      }
    };

    if (typeof layer.eachLayer === 'function') {
      layer.eachLayer((sub: any) => updateSingle(sub));
    } else {
      updateSingle(layer);
    }
  };

  // Sincronizar seleção com os estilos visuais e animação tracejada no mapa
  useEffect(() => {
    // Redefine todos os estilos para os padrões antes de aplicar a nova seleção
    Object.values(loadedLayersRef.current).forEach((geoJsonLayer: any) => {
      geoJsonLayer.eachLayer((lyr: any) => {
        applySelectedStyleToLayer(lyr, false);
      });
    });

    // Aplica o estilo destacado na lista atualizada de selecionados
    selectedFeatures.forEach(feat => {
      const lyr = feat.layer as any;
      if (lyr) {
        applySelectedStyleToLayer(lyr, true);
      }
    });

    // Sincroniza e redesenha a camada de Localidades na tela para o estado Apple Maps selecionado/deselecionado
    const locLayer = loadedLayersRef.current["Localidades (Piauí)"];
    if (locLayer && mapRef.current && mapRef.current.hasLayer(locLayer)) {
      const customColor = layerColorsRef.current["Localidades (Piauí)"] || '#FF3B30';
      updateLocalidadesViewport(locLayer, mapRef.current, selectedFeatures, customColor);
    }
  }, [selectedFeatures]);

  // ==============================================================
  // DISSOLVER FEIÇÕES POLIGONAIS (Turf v7 Union)
  // ==============================================================
  const [isDissolved, setIsDissolved] = useState<boolean>(false);
  const [isDissolving, setIsDissolving] = useState<boolean>(false);
  const dissolvedLayerRef = useRef<L.GeoJSON | null>(null);
  const dissolvedOriginalLayersRef = useRef<Map<any, L.PathOptions>>(new Map());

  // Filtrar apenas feições poligonais válidas da seleção (Polygon / MultiPolygon)
  const selectedPolygonFeatures = useMemo(() => {
    return selectedFeatures.filter(f => {
      if (!f || !f.layer) return false;
      if (f.id?.startsWith('plot-') || f.id === 'coord-search') return false;
      const lyr = f.layer as any;
      const geomType = lyr?.feature?.geometry?.type || 
        (typeof lyr?.toGeoJSON === 'function' ? lyr.toGeoJSON()?.geometry?.type : null);
      return geomType === 'Polygon' || geomType === 'MultiPolygon';
    });
  }, [selectedFeatures]);

  const selectedPolygonCount = selectedPolygonFeatures.length;

  // Limpar dissolução e restaurar o estado visual original de seleção
  const clearDissolve = useCallback(() => {
    if (dissolvedLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(dissolvedLayerRef.current);
      dissolvedLayerRef.current = null;
    }
    // Restaurar estilos das camadas originais
    dissolvedOriginalLayersRef.current.forEach((savedStyle, layer) => {
      if (layer) {
        if (layer.options) {
          layer.options.stroke = true;
          layer.options.dashArray = '';
          layer.options.className = '';
        }
        const styleToRestore: L.PathOptions = {
          stroke: true,
          ...savedStyle,
          dashArray: '',
          className: ''
        };
        if (typeof layer.setStyle === 'function') {
          layer.setStyle(styleToRestore);
        }
        const el = layer._path || (typeof layer.getElement === 'function' ? layer.getElement() : null);
        if (el) {
          el.removeAttribute('stroke-dasharray');
          el.classList.remove('selected-feature-animated-dash');
        }
      }
    });
    dissolvedOriginalLayersRef.current.clear();

    // Re-aplicar o destaque de seleção padrão às feições
    selectedFeatures.forEach(f => {
      if (f.layer) {
        applySelectedStyleToLayer(f.layer, true);
      }
    });

    setIsDissolved(false);
    setIsDissolving(false);
  }, [selectedFeatures]);

  // Executar a união geométrica das feições poligonais de forma assíncrona
  const computeDissolve = useCallback((polys: SelectedFeature[]) => {
    if (!mapRef.current) return;
    if (polys.length < 2) {
      clearDissolve();
      return;
    }

    if (polys.length > 200) {
      showToast(`Unindo ${polys.length} feições poligonais. Isso pode levar alguns segundos...`);
    }

    setIsDissolving(true);

    setTimeout(() => {
      try {
        const geojsonFeatures: any[] = [];
        for (const item of polys) {
          const lyr = item.layer as any;
          let feat = lyr?.feature;
          if (lyr && typeof lyr.toGeoJSON === 'function') {
            feat = lyr.toGeoJSON();
          }
          if (!feat || !feat.geometry) {
            continue;
          }
          if (feat.geometry.type !== 'Polygon' && feat.geometry.type !== 'MultiPolygon') {
            continue;
          }
          geojsonFeatures.push(feat);
        }

        if (geojsonFeatures.length < 2) {
          clearDissolve();
          setIsDissolving(false);
          return;
        }

        // União com Turf v7
        const fc = featureCollection(geojsonFeatures as any) as any;
        const unionResult = union(fc);

        if (!unionResult || !unionResult.geometry) {
          throw new Error('Não foi possível gerar a união das geometrias.');
        }

        const map = mapRef.current;
        if (!map) return;

        // Criar pane exclusivo para o contorno externo dissolvido se não existir
        if (!map.getPane('dissolvedPane')) {
          const pane = map.createPane('dissolvedPane');
          pane.style.zIndex = '620';
          pane.style.pointerEvents = 'none';
        }

        // Remover camada anterior de dissolução se houver
        if (dissolvedLayerRef.current) {
          map.removeLayer(dissolvedLayerRef.current);
          dissolvedLayerRef.current = null;
        }

        // Atenuar/esconder bordas internas das feições selecionadas
        polys.forEach(p => {
          const layer = p.layer as any;
          if (!layer) return;
          if (!dissolvedOriginalLayersRef.current.has(layer)) {
            dissolvedOriginalLayersRef.current.set(layer, {
              stroke: true,
              ...(layer.defaultStyle || layer.options || {}),
              color: layer.defaultStyle?.color || layer.options?.color || '#007AFF',
              weight: layer.defaultStyle?.weight || layer.options?.weight || 3,
              opacity: layer.defaultStyle?.opacity ?? layer.options?.opacity ?? 1,
              fillColor: layer.defaultStyle?.fillColor || layer.options?.fillColor || '#007AFF',
              fillOpacity: layer.defaultStyle?.fillOpacity ?? layer.options?.fillOpacity ?? 0.45,
            });
          }
          if (typeof layer.setStyle === 'function') {
            layer.setStyle({
              opacity: 0,
              weight: 0,
              stroke: false
            });
          }
          const el = layer._path || (typeof layer.getElement === 'function' ? layer.getElement() : null);
          if (el) {
            el.classList.remove('selected-feature-animated-dash');
            el.removeAttribute('stroke-dasharray');
          }
        });

        // Adicionar camada de contorno externo dissolvido em pane superior não interativo
        const newDissolvedLayer = L.geoJSON(unionResult as any, {
          pane: 'dissolvedPane',
          interactive: false,
          style: () => ({
            pane: 'dissolvedPane',
            interactive: false,
            color: '#007AFF',
            weight: 4,
            opacity: 1,
            fillColor: '#007AFF',
            fillOpacity: 0.08,
            lineCap: 'round',
            lineJoin: 'round'
          })
        });

        newDissolvedLayer.addTo(map);
        dissolvedLayerRef.current = newDissolvedLayer;
        setIsDissolved(true);
      } catch (err) {
        console.error('Erro ao dissolver polígonos:', err);
        showToast('Erro ao unir geometrias selecionadas. Verifique se os polígonos são válidos.');
        clearDissolve();
      } finally {
        setIsDissolving(false);
      }
    }, 10);
  }, [clearDissolve, showToast]);

  // Sincronização automática da dissolução quando a seleção muda
  useEffect(() => {
    if (!isDissolved) {
      if (dissolvedLayerRef.current) {
        clearDissolve();
      }
      return;
    }

    if (selectedPolygonCount < 2) {
      clearDissolve();
      showToast('Dissolução desfeita: menos de 2 polígonos selecionados.');
    } else {
      computeDissolve(selectedPolygonFeatures);
    }
  }, [isDissolved, selectedPolygonCount, selectedPolygonFeatures, clearDissolve, computeDissolve, showToast]);

  const handleToggleDissolve = useCallback(() => {
    if (isDissolved) {
      clearDissolve();
      showToast('Dissolução desfeita.');
    } else {
      if (selectedPolygonCount < 2) {
        showToast('Selecione pelo menos 2 polígonos para dissolver.');
        return;
      }
      setIsDissolved(true);
      computeDissolve(selectedPolygonFeatures);
      showToast('Polígonos dissolvidos em contorno único.');
    }
  }, [isDissolved, selectedPolygonCount, selectedPolygonFeatures, clearDissolve, computeDissolve, showToast]);

  // Inicializar o Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Inicializa o Leaflet Map estilo Apple Maps (sem zoom nativo quadrado)
    const map = L.map(mapContainerRef.current, { 
      zoomControl: false,
      preferCanvas: false,
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 60
    }).setView([-7.0, -42.8], 7);

    mapRef.current = map;
    setMapInstance(map);

    // LayerGroup dedicado para marcadores de busca/plotagem CNEFE com viewport otimizado
    const searchLayerGroup = L.layerGroup().addTo(map);
    searchLayerGroupRef.current = searchLayerGroup;

    // Add measuring tool
    if (typeof window !== 'undefined') {
      (window as any).L = L;
      import('leaflet-measure/dist/leaflet-measure.pt_BR.js').then(() => {
        if (mapRef.current !== map) return; // Prevent adding to destroyed map
        
        patchMeasureControl();

        // @ts-ignore
        if (L.control.measure) {
          // @ts-ignore
          const measureControl = L.control.measure({
            position: 'topright',
            primaryLengthUnit: 'meters',
            secondaryLengthUnit: 'kilometers',
            primaryAreaUnit: 'sqmeters',
            secondaryAreaUnit: 'hectares',
            activeColor: '#007AFF',
            completedColor: '#005bb5',
            popupOptions: { autoPan: false, className: 'leaflet-measure-resultpopup' }
          });
          measureControl.addTo(map);
          (map as any).measureControl = measureControl;
        }
      }).catch(err => console.error("Error loading leaflet-measure", err));
    }

    map.on('measurefinish', (e: any) => {
      setIsMeasuringActive(false);
      lastMeasureModelRef.current = e;
    });

    if (onMeasureChange) {
      map.on('measurechange', (e: any) => {
        if (e.latlngs === null) {
          setIsMeasuringActive(false);
        } else if (Array.isArray(e.latlngs) && e.latlngs.length > 0) {
          setIsMeasuringActive(true);
        }
        onMeasureChange(e.latlngs);
      });
    }

    // Intercepta qualquer camada de resultado da medição criada para torná-la sempre interativa e clicável
    map.on('layeradd', (e: any) => {
      const layer = e.layer;
      if (!layer) return;

      const className = layer.options?.className;
      if (
        className === 'layer-measure-resultarea' ||
        className === 'layer-measure-resultline' ||
        className === 'layer-measure-resultpoint'
      ) {
        layer.options.interactive = true;

        if (typeof layer.bringToFront === 'function') {
          layer.bringToFront();
        }

        layer.on('mouseover', () => {
          if (typeof layer.bringToFront === 'function') {
            layer.bringToFront();
          }
        });

        layer.on('click', (ev: any) => {
          if (ev.originalEvent) {
            L.DomEvent.stopPropagation(ev);
          }
          if (typeof layer.bringToFront === 'function') {
            layer.bringToFront();
          }
          // Atualiza o card flutuante superior em vez de abrir popup no meio
          if (className === 'layer-measure-resultarea') {
            const model = lastMeasureModelRef.current;
            let points = model?.points;
            if (!points && typeof layer.getLatLngs === 'function') {
              const lls = layer.getLatLngs();
              points = Array.isArray(lls[0]) ? lls[0] : lls;
            }
            if (points && points.length >= 3) {
              setActiveMeasureInfo({
                layer,
                areaDisplay: model?.areaDisplay || 'Área Medida',
                lengthDisplay: model?.lengthDisplay || '',
                points
              });
            }
          }
        });

        if (className === 'layer-measure-resultarea') {
          const model = lastMeasureModelRef.current;
          let points = model?.points;
          if (!points && typeof layer.getLatLngs === 'function') {
            const lls = layer.getLatLngs();
            points = Array.isArray(lls[0]) ? lls[0] : lls;
          }
          if (points && points.length >= 3) {
            setActiveMeasureInfo({
              layer,
              areaDisplay: model?.areaDisplay || 'Área Medida',
              lengthDisplay: model?.lengthDisplay || '',
              points
            });
          }
        }
      }
    });

    // Injeta botão de busca CNEFE e formata o popup de resultado da medição (Estilo Apple Maps)
    map.on('popupopen', (e: any) => {
      const popup = e.popup;
      if (!popup) return;
      const container = popup.getElement ? popup.getElement() : null;
      if (!container) return;

      const isMeasurePopup = container.classList?.contains('leaflet-measure-resultpopup') ||
                             container.querySelector('.leaflet-measure-resultpopup') ||
                             container.querySelector('.js-deletemarkup');

      if (isMeasurePopup) {
        // Usuário solicitou que o popup não apareça no meio do mapa ao concluir a medição,
        // pois o card flutuante no canto superior esquerdo já mostra as mesmas informações completas.
        map.closePopup(popup);
        return;
      }
    });

    let lastWidth = mapContainerRef.current.clientWidth;
    let lastHeight = mapContainerRef.current.clientHeight;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (!mapContainerRef.current || !mapRef.current) return;
        const newWidth = mapContainerRef.current.clientWidth;
        const newHeight = mapContainerRef.current.clientHeight;
        
        if (newWidth !== lastWidth || newHeight !== lastHeight) {
          lastWidth = newWidth;
          lastHeight = newHeight;
          mapRef.current.invalidateSize({ pan: false });
        }
      });
    });
    resizeObserver.observe(mapContainerRef.current);

    // Configurar as opções de Basemaps com a API Key CARTO fornecida pelo usuário
    const CARTO_API_KEY = 'cb1_26l5_1_d7bcaa768a4e7a1dfcb1948d';
    tileLayersRef.current = {
      apple: L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, { 
        maxZoom: 20,
        subdomains: ['a', 'b', 'c', 'd'],
        attribution: '&copy; Apple Maps Style (CARTO Voyager)' 
      }),
      appleDark: L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, { 
        maxZoom: 20,
        subdomains: ['a', 'b', 'c', 'd'],
        attribution: '&copy; Apple Maps Escuro Style (CARTO Dark)' 
      }),
      googleHybrid: L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { 
        maxZoom: 20, 
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], 
        attribution: '&copy; Google Híbrido' 
      }),
      googleSat: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { 
        maxZoom: 20, 
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], 
        attribution: '&copy; Google Satélite' 
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '&copy; OpenStreetMap' 
      }),
      esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
        attribution: 'Tiles &copy; Esri' 
      }),
      carto: L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, { 
        attribution: '&copy; Carto Light' 
      })
    };

    // Adiciona o basemap padrão (Apple Maps)
    const initialTile = tileLayersRef.current[basemap] || tileLayersRef.current.apple;
    initialTile.addTo(map);

    map.on('click', (e: any) => {
      // Ignore click if the measuring tool is active
      if (isMeasuringActiveRef.current) {
        return;
      }
      const measuringPrompt = document.querySelector('.js-measuringprompt') as HTMLElement;
      if (measuringPrompt && measuringPrompt.style.display !== 'none') {
        return;
      }

      // Clique no mapa sem feição limpa a seleção e o balão callout de polígonos
      if (e.originalEvent && (e.originalEvent as any)._simulated) return;
      // Se a seleção atual é uma coordenada pesquisada (pino de botão direito), não limpar ao clicar no mapa
      const hasCoordSearch = selectedFeaturesRef.current.some(f => f.id === 'coord-search' || f.sourceName === 'Coordenadas');
      if (hasCoordSearch) return;
      clearPolygonCallout();
      onSelectionChangeRef.current?.([]);
    });

    map.on('measurestart', () => {
      setIsMeasuringActive(true);
      // Correção para o erro da ferramenta de medição que move o mapa para a direita
      // O leaflet-measure cria um marcador gigante invisível que recebe foco ao clicar.
      // Como o marcador é maior que o mapa, o foco faz o navegador "rolar" (pan) para tentar mostrar o topo dele.
      // Removendo o tabindex evitamos que ele receba foco e mova o mapa.
      setTimeout(() => {
        const markers = mapContainerRef.current?.querySelectorAll('.leaflet-marker-icon');
        if (markers) {
          markers.forEach(el => {
            if ((el as HTMLElement).style.opacity === '0') {
              el.removeAttribute('tabindex');
            }
          });
        }
      }, 50);
    });

    // Registrar o evento de Context Menu (Botão Direito) no mapa - Fixar Pino Apple Maps
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const latFormatted = lat.toFixed(6);
      const lngFormatted = lng.toFixed(6);

      // Ícone elegante de Pino no estilo Apple Maps (Vibrante Carmim / Vermelho Apple)
      const contextPinIcon = L.divIcon({
        className: 'custom-context-marker-pin',
        html: `
          <div style="width: 28px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
            <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="#007AFF" stroke="#FFFFFF" stroke-width="1.8"/>
              <circle cx="14" cy="13.5" r="5" fill="#FFFFFF"/>
              <circle cx="14" cy="13.5" r="2.5" fill="#007AFF"/>
            </svg>
          </div>
        `,
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -34]
      });

      // Remover pino anterior se já existir um
      if (rightClickMarkerRef.current) {
        map.removeLayer(rightClickMarkerRef.current);
        rightClickMarkerRef.current = null;
      }

      // Adicionar novo pino na coordenada clicada com botão direito
      const marker = L.marker([lat, lng], {
        icon: contextPinIcon,
        zIndexOffset: 1200
      }).addTo(map);

      rightClickMarkerRef.current = marker;

      const popupContent = `
        <div class="apple-cnefe-container" style="min-width: 250px; max-width: 285px;">
          <!-- Linha de Cabeçalho: Badge Padrão e Botão Remover Neutro -->
          <div class="apple-cnefe-header-row">
            <div class="apple-cnefe-badge blue">
              <span class="apple-cnefe-dot blue"></span>
              <span>Coordenada</span>
            </div>
            <button 
              type="button" 
              class="apple-cnefe-dist-badge" 
              onclick="event.preventDefault(); event.stopPropagation(); if(window.removeRightClickPin) window.removeRightClickPin();"
              style="cursor: pointer; background: rgba(100, 116, 139, 0.08); color: #64748b; border: 1px solid rgba(100, 116, 139, 0.2);"
              title="Remover este ponto do mapa"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Remover</span>
            </button>
          </div>

          <!-- Bloco Hero -->
          <div class="apple-cnefe-hero">
            <div class="apple-cnefe-hero-title-row">
              <h4 class="apple-cnefe-hero-title">Ponto Geográfico Marcado</h4>
            </div>
            <p class="apple-cnefe-hero-subtitle">Clique com o botão direito para reposicionar</p>
          </div>

          <!-- Cápsula de Coordenadas Geográficas -->
          <div class="apple-cnefe-coords-capsule">
            <div 
              class="apple-cnefe-coords-header webgis-copyable"
              data-copy="${latFormatted}, ${lngFormatted}"
              data-label="Coordenadas completas"
              onclick="event.preventDefault(); event.stopPropagation(); window.copyPopupEl(this, event);"
              onkeydown="window.handlePopupKeydown(this, event);"
              tabindex="0"
              role="button"
              title="Clique para copiar par de coordenadas (${latFormatted}, ${lngFormatted})"
            >
              <span class="webgis-copy-original">Coordenadas Geográficas</span>
              <span class="webgis-copy-feedback">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Copiado</span>
              </span>
            </div>
            <div class="apple-cnefe-coords-grid">
              <button 
                type="button" 
                class="apple-cnefe-coord-pill webgis-copyable" 
                data-copy="${latFormatted}"
                data-label="Latitude"
                onclick="event.preventDefault(); event.stopPropagation(); window.copyPopupEl(this, event);"
                title="Clique para copiar Latitude (${latFormatted})"
              >
                <div class="webgis-copy-original" style="display: flex; flex-direction: column; align-items: center; gap: 1px;">
                  <span class="apple-cnefe-coord-tag">LAT</span>
                  <span class="apple-cnefe-coord-val">${latFormatted}</span>
                </div>
                <div class="webgis-copy-feedback">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Copiado</span>
                </div>
              </button>

              <button 
                type="button" 
                class="apple-cnefe-coord-pill webgis-copyable" 
                data-copy="${lngFormatted}"
                data-label="Longitude"
                onclick="event.preventDefault(); event.stopPropagation(); window.copyPopupEl(this, event);"
                title="Clique para copiar Longitude (${lngFormatted})"
              >
                <div class="webgis-copy-original" style="display: flex; flex-direction: column; align-items: center; gap: 1px;">
                  <span class="apple-cnefe-coord-tag">LNG</span>
                  <span class="apple-cnefe-coord-val">${lngFormatted}</span>
                </div>
                <div class="webgis-copy-feedback">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>Copiado</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Ações Rápidas: Pesquisar Feições e Street View (Cores Padrão do Site) -->
          <div class="apple-cnefe-actions-row">
            <button
              type="button"
              class="apple-cnefe-action-btn"
              onclick="event.preventDefault(); event.stopPropagation(); if(window.identifyFeaturesFromCtx) window.identifyFeaturesFromCtx('${latFormatted}', '${lngFormatted}');"
              style="background: #007AFF; color: #ffffff; border: 1px solid #007AFF;"
              title="Pesquisar feições e camadas nesta coordenada"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>Pesquisar Feições</span>
            </button>

            <a 
              href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFormatted},${lngFormatted}" 
              target="_blank" 
              rel="noreferrer" 
              class="apple-cnefe-action-btn streetview" 
              style="background: rgba(0, 122, 255, 0.08); color: #007AFF; border: 1px solid rgba(0, 122, 255, 0.2);"
              title="Abrir no Google Street View"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
              <span>Street View</span>
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'apple-cnefe-popup',
        closeButton: true
      });

      marker.openPopup();
    });

    // Função de limpeza do mapa ao desmontar
    return () => {
      resizeObserver.disconnect();
      if (rightClickMarkerRef.current && map) {
        map.removeLayer(rightClickMarkerRef.current);
        rightClickMarkerRef.current = null;
      }
      if (searchLayerGroupRef.current) {
        searchLayerGroupRef.current.clearLayers();
        if (map.hasLayer(searchLayerGroupRef.current)) {
          map.removeLayer(searchLayerGroupRef.current);
        }
        searchLayerGroupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, []);

  // Monitorar mudança de Basemap
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remover basemaps antigos
    Object.values(tileLayersRef.current).forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Adicionar novo basemap
    const selectedTile = tileLayersRef.current[basemap];
    if (selectedTile) {
      selectedTile.addTo(map);
    }
  }, [basemap]);

  // Função para renderizar progressivamente apenas os pontos de busca/CNEFE visíveis no viewport
  // Mantém 60 FPS mesmo com milhares de pontos plotados (ex: hospitais de um município inteiro)
  const updatePlottedViewport = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!searchLayerGroupRef.current) {
      searchLayerGroupRef.current = L.layerGroup().addTo(map);
    }
    const layer = searchLayerGroupRef.current;
    if (!map.hasLayer(layer)) {
      layer.addTo(map);
    }

    const allMarkers = allSearchMarkersRef.current;
    if (!allMarkers || allMarkers.length === 0) {
      layer.clearLayers();
      return;
    }

    const activePlottedId = selectedPlottedIdRef.current;
    const hasMultiple = allMarkers.length > 1;

    // Se houver apenas 1 ponto marcado (ex: busca individual ou clique em endereço único)
    if (allMarkers.length === 1) {
      const singleMarker = allMarkers[0];
      if (typeof singleMarker.setOpacity === 'function') singleMarker.setOpacity(1.0);
      if (typeof singleMarker.setZIndexOffset === 'function') singleMarker.setZIndexOffset(0);
      if (!layer.hasLayer(singleMarker)) {
        layer.clearLayers();
        layer.addLayer(singleMarker);
      }
      return;
    }

    const currentZoom = map.getZoom();

    // Se o zoom for muito distante (< 7), oculta pontos para não poluir o mapa estadual
    if (currentZoom < 7) {
      layer.clearLayers();
      return;
    }

    const bounds = map.getBounds().pad(0.1);

    // Limites de densidade progressiva por nível de zoom
    const maxVisibleInViewport = 
      currentZoom >= 15 ? 400 :
      currentZoom >= 14 ? 200 :
      currentZoom >= 13 ? 120 :
      currentZoom >= 11 ? 60 :
      currentZoom >= 10 ? 30 :
      currentZoom >= 9 ? 16 : 8;

    const nextVisible = new Set<any>();
    let count = 0;

    for (let i = 0; i < allMarkers.length; i++) {
      const marker = allMarkers[i];
      const latLng = (marker as any).featureLatLng;

      if (latLng && bounds.contains(latLng)) {
        const passesZoom = currentZoom >= ((marker as any).minZoom ?? 8);
        const isSelected = !!activePlottedId && (marker as any).plotId === activePlottedId;

        if (passesZoom || isSelected) {
          if (hasMultiple && activePlottedId) {
            if (isSelected) {
              if (typeof marker.setOpacity === 'function') marker.setOpacity(1.0);
              if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(1000);
            } else {
              if (typeof marker.setOpacity === 'function') marker.setOpacity(0.45);
              if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(0);
            }
          } else {
            if (typeof marker.setOpacity === 'function') marker.setOpacity(1.0);
            if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(0);
          }

          nextVisible.add(marker);
          count++;
          if (count >= maxVisibleInViewport) break;
        }
      }
    }

    // Adiciona apenas os novos que devem ficar visíveis e ainda não estão
    nextVisible.forEach(marker => {
      if (!layer.hasLayer(marker)) {
        layer.addLayer(marker);
      }
    });

    // Remove apenas os que saíram do viewport (mantendo o selecionado)
    layer.eachLayer((marker: any) => {
      const isSelected = !!activePlottedId && (marker as any).plotId === activePlottedId;
      if (!nextVisible.has(marker) && !isSelected) {
        layer.removeLayer(marker);
      }
    });
  }, []);

  // Monitorar busca por coordenada para exibir marcadores temporários com controle de viewport
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remover marcadores antigos se existirem
    if (searchLayerGroupRef.current) {
      searchLayerGroupRef.current.clearLayers();
    }
    allSearchMarkersRef.current = [];
    searchMarkersRef.current = [];

    if (searchCoordinates && searchCoordinates.length > 0) {
      // Remove pino anterior do botão direito se houver para não sobrepor
      if (rightClickMarkerRef.current && map) {
        map.removeLayer(rightClickMarkerRef.current);
        rightClickMarkerRef.current = null;
      }

      const minZooms = computeSpatialMinZoomsForCoords(searchCoordinates);
      const newMarkers: any[] = [];

      searchCoordinates.forEach((coord, index) => {
        const { lat, lng, details, isCoordSearch, label, rawAddress } = coord;
        
        // Mapear detalhes e atributos brutos do endereço
        const detailsMap: Record<string, string> = {};
        if (details && details.length > 0) {
          details.forEach(d => {
            const idx = d.indexOf(':');
            if (idx > -1) {
              const k = d.slice(0, idx).trim().toLowerCase();
              const v = d.slice(idx + 1).trim();
              detailsMap[k] = v;
            }
          });
        }

        const raw = rawAddress || {};
        const estabRaw = raw.estabelecimento || raw.ESTABELECIMENTO || raw['Identificação do estabelecimento'] || detailsMap['identificação do estabelecimento'] || '';
        const enderecoRaw = raw.endereco || raw.ENDERECO || detailsMap['endereço'] || label || '';
        const numeroRaw = raw.numero_logradouro || raw.NUMERO_LOGRADOURO || raw['Número no logradouro'] || detailsMap['número no logradouro'] || detailsMap['número'] || '';
        const complRaw = raw.complemento || raw.COMPLEMENTO || detailsMap['complemento'] || '';
        const bairroRaw = raw.bairro || raw.BAIRRO || detailsMap['bairro'] || '';
        const municipioRaw = raw.municipio || raw.MUNICIPIO || detailsMap['município'] || '';
        const cepRaw = raw.cep || raw.CEP || detailsMap['cep'] || '';
        const localidadeRaw = raw.localidade || raw.LOCALIDADE || detailsMap['localidade'] || '';
        const especieRaw = raw.especie || raw.ESPECIE || raw['Espécie de endereço'] || detailsMap['espécie'] || detailsMap['espécie de endereço'] || '';
        const distTexto = raw.distancia_texto || detailsMap['distância'] || '';
        const codigoUnico = raw.codigo_unico || raw['Código único do endereço'] || detailsMap['código único do endereço'] || '';

        // Identificar se o ponto é estabelecimento de saúde ou hospital
        const isSaude = (details || []).some(d => {
          const low = d.toLowerCase();
          return low.includes('saúde') || low.includes('saude') || low.includes('hospital') || low.includes('ubs') || low.includes('clínica') || low.includes('clinica') || low.includes('maternidade') || low.includes('pronto socorro');
        }) || (label || '').toLowerCase().includes('hospital') || (label || '').toLowerCase().includes('saude') || (especieRaw || '').toLowerCase().includes('saude') || (estabRaw || '').toLowerCase().includes('hospital');

        const detectedOrigem = coord.origem || detectCategoryFromData(rawAddress, coord.label) || (isSaude ? 'tipo-saude' : undefined);
        const chosenIcon = createCategoryPinIcon(detectedOrigem);

        // Criar marcador para renderização progressiva por viewport
        const marker = L.marker([lat, lng], { icon: chosenIcon });
        (marker as any).featureLatLng = L.latLng(lat, lng);
        (marker as any).minZoom = searchCoordinates.length === 1 ? 1 : minZooms[index];
        (marker as any).plotIndex = index;
        (marker as any).plotId = `plot-${index}`;

        marker.on('click', () => {
          if (onPlottedPointClickRef.current) {
            onPlottedPointClickRef.current(index, coord, marker);
          }
        });

        newMarkers.push(marker);
      });

      allSearchMarkersRef.current = newMarkers;
      searchMarkersRef.current = newMarkers;

      updatePlottedViewport();
    } else {
      updatePlottedViewport();
    }
  }, [searchCoordinates, updatePlottedViewport]);

  // Destaque visual do marcador plotado selecionado (sem recriar marcadores)
  useEffect(() => {
    let activePlottedId: string | null = null;
    for (let i = selectedFeatures.length - 1; i >= 0; i--) {
      if (selectedFeatures[i].id && selectedFeatures[i].id.startsWith('plot-')) {
        activePlottedId = selectedFeatures[i].id;
        break;
      }
    }

    selectedPlottedIdRef.current = activePlottedId;

    const allMarkers = allSearchMarkersRef.current;
    if (!allMarkers || allMarkers.length === 0) return;

    const hasMultiple = allMarkers.length > 1;

    allMarkers.forEach(marker => {
      if (!marker) return;
      const isSelected = !!activePlottedId && (marker as any).plotId === activePlottedId;

      if (hasMultiple && activePlottedId) {
        if (isSelected) {
          if (typeof marker.setOpacity === 'function') marker.setOpacity(1.0);
          if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(1000);
        } else {
          if (typeof marker.setOpacity === 'function') marker.setOpacity(0.45);
          if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(0);
        }
      } else {
        if (typeof marker.setOpacity === 'function') marker.setOpacity(1.0);
        if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(0);
      }
    });
  }, [selectedFeatures, searchCoordinates]);

  // Função para aplicar ordem visual de sobreposição das camadas no mapa Leaflet
  const applyMapLayerOrder = (order: string[]) => {
    if (!mapRef.current) return;
    const reversed = [...order].reverse();
    reversed.forEach(sourceName => {
      const layer = loadedLayersRef.current[sourceName];
      if (layer && mapRef.current?.hasLayer(layer)) {
        if (typeof (layer as any).bringToFront === 'function') {
          (layer as any).bringToFront();
        }
      }
    });
  };

  // Sincronizar de forma reativa as camadas presentes no mapa com o array activeLayers e visibleLayers (Paralelizado e Otimizado)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const syncMapLayers = async () => {
      const currentZoom = map.getZoom();
      
      try {
        const visibleSources = dataSources.filter(source => {
          const isAllowed = allowedLayerNames ? allowedLayerNames.includes(source.name) : true;
          const isPinned = isAllowed && activeLayers.includes(source.name);
          return isPinned && (visibleLayers[source.name] !== false);
        });

        const nonVisibleSources = dataSources.filter(source => !visibleSources.includes(source));

        // Carrega todas as camadas ativas em paralelo para acelerar o carregamento em até 80%
        await Promise.all(visibleSources.map(async (source) => {
          try {
            const layer = await loadLayer(source);
            if (!mapRef.current || mapRef.current !== map) return;

            const passesZoomCheck = source.name === "Localidades (Piauí)" ? currentZoom >= 8 : true;

            if (source.name === "Localidades (Piauí)" && (layer as any).allMarkers) {
              const customColor = layerColorsRef.current[source.name] || '#FF3B30';
              updateLocalidadesViewport(layer, map, selectedFeaturesRef.current, customColor);
            }

            if (!map.hasLayer(layer) && passesZoomCheck) {
              layer.addTo(map);
            } else if (map.hasLayer(layer) && !passesZoomCheck) {
              map.removeLayer(layer);
            }
          } catch (err) {
            console.error(`Erro ao carregar camada: ${source.name}`, err);
          }
        }));

        // Remove camadas que não estão mais visíveis
        nonVisibleSources.forEach(source => {
          const layer = loadedLayersRef.current[source.name];
          if (layer && map.hasLayer(layer)) {
            map.removeLayer(layer);
          }
          map.eachLayer((lyr: any) => {
            if (lyr.customSourceName === source.name) {
              map.removeLayer(lyr);
            }
          });
        });

        applyMapLayerOrder(activeLayers.filter(name => (allowedLayerNames ? allowedLayerNames.includes(name) : true) && visibleLayers[name] !== false));
        updateLegendViewport();
        updatePlottedViewport();
      } finally {
        setIsLoading(false);
      }
    };

    syncMapLayers();
    
    // Atualização com debounce suave ao arrastar o mapa para manter 60 FPS
    let moveTimer: any = null;
    const handleDebouncedMapMove = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        if (!mapRef.current) return;
        const locLayer = loadedLayersRef.current["Localidades (Piauí)"];
        if (locLayer && map.hasLayer(locLayer)) {
          const customColor = layerColorsRef.current["Localidades (Piauí)"] || '#FF3B30';
          updateLocalidadesViewport(locLayer, map, selectedFeaturesRef.current, customColor);
        }
        updateLegendViewport();
        updatePlottedViewport();
      }, 100);
    };

    map.on('zoomend', syncMapLayers);
    map.on('moveend', handleDebouncedMapMove);
    return () => {
      if (moveTimer) clearTimeout(moveTimer);
      map.off('zoomend', syncMapLayers);
      map.off('moveend', handleDebouncedMapMove);
    };
  }, [activeLayers, visibleLayers, allowedLayerNames, updateLegendViewport, updatePlottedViewport]);

  const prevAllowedRef = useRef<string[] | undefined>(allowedLayerNames);

  // Descarregar do mapa camadas revogadas e reativar visibilidade de camadas reautorizadas
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (allowedLayerNames) {
      const prev = prevAllowedRef.current || [];
      const newlyAllowed = allowedLayerNames.filter(name => !prev.includes(name));
      prevAllowedRef.current = allowedLayerNames;

      if (newlyAllowed.length > 0) {
        setVisibleLayers(curr => {
          const updated = { ...curr };
          newlyAllowed.forEach(name => {
            if (DEFAULT_ACTIVE_LAYERS.includes(name)) {
              updated[name] = true;
            }
          });
          return updated;
        });
      }

      dataSources.forEach(source => {
        if (!allowedLayerNames.includes(source.name)) {
          const lyr = loadedLayersRef.current[source.name];
          if (lyr && map.hasLayer(lyr)) {
            map.removeLayer(lyr);
          }
          map.eachLayer((existingLayer: any) => {
            if (existingLayer.customSourceName === source.name) {
              map.removeLayer(existingLayer);
            }
          });
        }
      });
    }
  }, [allowedLayerNames]);

  // Registrar ações do mapa para o componente pai App.tsx
  useEffect(() => {
    registerMapActions({
      loadLayerByName: async (name: string) => {
        if (allowedLayerNames && !allowedLayerNames.includes(name)) {
          throw new Error(`Acesso não autorizado para a camada "${name}".`);
        }
        const src = dataSources.find(s => s.name === name);
        if (!src) throw new Error(`Layer ${name} not found`);
        return await loadLayer(src);
      },
      searchLayerByName: async (name: string, anchor: string, num: string | null, localities: string[], rawQuery?: string) => {
        if (allowedLayerNames && !allowedLayerNames.includes(name)) {
          throw new Error(`Acesso não autorizado para a camada "${name}".`);
        }
        const src = dataSources.find(s => s.name === name);
        if (!src) throw new Error(`Layer ${name} not found`);
        return await loadLayer(src, { anchor, num, localities, rawQuery });
      },
      zoomToFeature: (layer: L.Layer) => {
        if (!mapRef.current) return;
        if (typeof (layer as any).getBounds === 'function' && (layer as any).getBounds().isValid()) {
          const bounds = (layer as any).getBounds();
          mapRef.current.fitBounds(bounds, {
            paddingTopLeft: L.point(280, 50),
            paddingBottomRight: L.point(50, 50),
            maxZoom: 15,
            animate: true,
            duration: 0.3
          });
        } else if (typeof (layer as any).getLatLng === 'function') {
          mapRef.current.setView((layer as any).getLatLng(), 14);
        }
      },
      selectFeature: (layer: L.Layer, feature: any, sourceName: string) => {
        const props = feature?.properties || {};
        const source = dataSources.find(s => s.name === sourceName);
        const rawValue = props[source?.popupProperty || ''];
        const displayValue = getTranslatedValue(source?.popupProperty || '', rawValue);
        const title = displayValue != null && String(displayValue).trim() !== '' ? String(displayValue) : getIdentifier(props);

        const isArea = [
          'Favelas e Comunidades',
          'Bairros',
          'Núcleos Urbanos',
          'Aglomerados Rurais',
          'Comunidades Rurais de Teresina',
          'Municipios'
        ].includes(sourceName);

        if (isArea && (layer as any)._popupContentHtml) {
          openPolygonCallout(layer, (layer as any)._popupContentHtml, undefined, false);
        }

        onSelectionChangeRef.current?.([{
          id: String((layer as any)._leaflet_id),
          name: title,
          sourceName: sourceName,
          layer: layer,
          properties: props
        }]);
      },
      removeMeasurePoint: (index: number) => {
        if (mapRef.current && (mapRef.current as any).measureControl) {
          (mapRef.current as any).measureControl.removePoint(index);
        }
      }
    });
  }, [activeLayers, registerMapActions]);

  // Função para carregar a camada de forma assíncrona
  const loadLayer = async (source: DataSource, searchParams: { anchor: string, num: string | null, localities: string[], rawQuery?: string } | null = null): Promise<L.GeoJSON> => {
    if (allowedLayerNames && !allowedLayerNames.includes(source.name)) {
      throw new Error(`Acesso não autorizado para a camada "${source.name}".`);
    }

    if (!searchParams && loadedLayersRef.current[source.name]) {
      return loadedLayersRef.current[source.name];
    }

    setIsLoading(true);
    setStatusText(`Carregando dados de ${source.name}...`);

    try {
      let data: any;
      const resp = await fetch(source.url);
      if (!resp.ok) {
        throw new Error(`Falha ao obter os dados de ${source.name}: ${resp.status}`);
      }
      data = await resp.json();

      const geojsonOptions: L.GeoJSONOptions = {
        style: (feature: any) => {
          const baseStyle = typeof source.style === 'function' 
            ? source.style(feature) 
            : (typeof source.style === 'object' && source.style ? { ...(source.style as any) } : {});
          
          const customColor = layerColorsRef.current[source.name];
          const customStrokeColor = layerStrokeColorsRef.current[source.name];
          
          return {
            ...baseStyle,
            ...(customColor ? { fillColor: customColor } : {}),
            ...(customStrokeColor ? { color: customStrokeColor } : {}),
            fillOpacity: layerOpacities[source.name] ?? (source.name === "Localidades (Piauí)" ? 0.5 : (source.name === "Municipios" ? 0 : 0.1)),
          } as any;
        },
        onEachFeature: (feature, layer: any) => {
          layer.customSourceName = source.name;
          const originalStyle = typeof source.style === 'function' ? source.style(feature) : source.style;
          const customColor = layerColorsRef.current[source.name];
          const customStrokeColor = layerStrokeColorsRef.current[source.name];
          layer.defaultStyle = { 
            ...originalStyle, 
            ...(customColor ? { fillColor: customColor } : {}),
            ...(customStrokeColor ? { color: customStrokeColor } : {}),
            fillOpacity: layerOpacities[source.name] ?? (source.name === "Localidades (Piauí)" ? 0.5 : (source.name === "Municipios" ? 0 : 0.1)),
            dashArray: '',
            className: ''
          };
          
          const props = feature?.properties || {};
          const rawValue = props[source.popupProperty];
          const displayValue = getTranslatedValue(source.popupProperty, rawValue);
          const rawTitle = displayValue != null && String(displayValue).trim() !== '' ? String(displayValue) : getIdentifier(props);
          const title = toTitleCase(rawTitle);
          const fieldLabel = propertyNames[source.popupProperty] || source.popupProperty || 'Identificador';
          const subdistrito = props.SUBDISTRITO || props.Subdistrito || props.subdistrito || props.NM_SUBDIST || props['Nome do subdistrito'];
          const bairro = props.BAIRRO || props.Bairro || props.bairro || props.NM_BAIRRO;
          const aisp = props.AISP || props.Aisp || props.aisp;
          const risp = props.RISP || props.Risp || props.risp;
          const municipio = props.MUNICIPIO || props.Municipio || props.municipio || props['Nome do município'] || props.NM_MUNICIP;
          const areaDesenvolvimento = props['Area de desenvolvimento'] || props['Área de desenvolvimento'] || props.AREA_DESENVOLVIMENTO || props.area_desenvolvimento;
          const latitude = props.LATITUDE || props.Latitude || props.latitude || props.LAT || props.Lat || props.lat;
          const longitude = props.LONGITUDE || props.Longitude || props.longitude || props.LON || props.Lon || props.lon || props.LNG || props.Lng || props.lng;
          
          let extraInfo = '';
          
          const titleStr = String(title).toUpperCase().trim();
          const isTeresinaOrParnaiba = source.name === "Municipios" && (titleStr === "TERESINA" || titleStr === "PARNAÍBA" || titleStr === "PARNAIBA");
          
          const isAispLayer = source.name === "AISP";
          const isFavelasLayer = source.name === "Favelas e Comunidades";
          const isLocalidadesLayer = source.name === "Localidades (Piauí)";
          
          const layerDotColor = customStrokeColor || customColor || getLayerColor(source.name) || '#e11d48';

          const escapeHtml = (str: string): string => {
            return String(str)
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          };

          const renderCopyableField = (label: string, val: string) => {
            const safeVal = escapeHtml(String(val));
            const safeLabel = escapeHtml(String(label));
            return `
              <div class="webgis-popup-attribute-item">
                <span class="webgis-popup-attr-label">${label}</span>
                <div class="webgis-popup-attr-val-box">
                  <span 
                    class="webgis-popup-attr-val webgis-copyable" 
                    data-copy="${safeVal}" 
                    data-label="${safeLabel}"
                    onclick="event.preventDefault(); event.stopPropagation(); window.copyPopupEl(this, event);"
                    onkeydown="window.handlePopupKeydown(this, event);"
                    tabindex="0"
                    role="button"
                    title="Clique para copiar ${safeLabel}"
                  >
                    <span class="webgis-copy-original">${val}</span>
                    <span class="webgis-copy-feedback">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Copiado</span>
                    </span>
                  </span>
                </div>
              </div>
            `;
          };
          
          if (aisp && !isTeresinaOrParnaiba && !isAispLayer && source.name !== "Áreas de Desenvolvimento" && source.name !== "RISP") {
            extraInfo += renderCopyableField('AISP', aisp);
          }
          
          if (risp && (isTeresinaOrParnaiba || isAispLayer || source.name === "Municipios")) {
            extraInfo += renderCopyableField('RISP', risp);
          }
          
          if (areaDesenvolvimento && source.name === "Municipios") {
            extraInfo += renderCopyableField('Área Desenv.', toTitleCase(areaDesenvolvimento));
          }
          
          if (subdistrito) {
            const labelSubdistrito = source.name === "Aglomerados Rurais" ? "SUBDISTRITO" : "ZONA";
            extraInfo += renderCopyableField(labelSubdistrito, toTitleCase(subdistrito));
          }
          
          if (isFavelasLayer && bairro) {
            extraInfo += renderCopyableField('BAIRRO', toTitleCase(bairro));
          }
          
          if (isLocalidadesLayer) {
            if (municipio) {
              extraInfo += renderCopyableField('MUNICÍPIO', toTitleCase(municipio));
            }
            if (latitude && longitude) {
              const coordStr = `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
              extraInfo += renderCopyableField('COORDENADA', coordStr);
            }
          }

          // Atribuir e obter o ID único do Leaflet
          const layerId = String(L.Util.stamp(layer));

          // Registrar feição para buscas espaciais pelo layer id
          layerFeatureMapRef.current[layerId] = {
            feature,
            title,
            sourceName: source.name,
            layer
          };

          const isPolygon = feature?.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon');
          const isAreaLayer = [
            'Favelas e Comunidades',
            'Bairros',
            'Núcleos Urbanos',
            'Aglomerados Rurais',
            'Comunidades Rurais de Teresina',
            'Municipios'
          ].includes(source.name);

          let searchPolygonBtnHtml = '';
          if (isPolygon || isAreaLayer) {
            const isComunidadesRurais = source.name === 'Comunidades Rurais de Teresina';
            const btnLabel = isComunidadesRurais ? 'Busca Endereços' : 'Buscar Endereços CNEFE';
            searchPolygonBtnHtml = `
              <button 
                type="button"
                class="webgis-popup-cnefe-btn"
                onclick="event.preventDefault(); event.stopPropagation(); if (window.searchAddressesInPolygonByLayerId) window.searchAddressesInPolygonByLayerId('${layerId}');"
                title="Consultar e listar todos os endereços contidos neste polígono"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>${btnLabel}</span>
              </button>
            `;
          }

          let extraInfoHtml = '';
          if (extraInfo.trim() !== '') {
            extraInfoHtml = `
              <div class="webgis-popup-attributes-grid">
                ${extraInfo}
              </div>
            `;
          }

          // Pop-up HTML moderno e elegante com suporte a cópia e busca CNEFE
          const popupContentHtml = `
            <div class="webgis-popup-container">
              <div class="webgis-popup-badge-row">
                <div class="webgis-popup-badge">
                  <span class="webgis-popup-dot" style="background-color: ${layerDotColor};"></span>
                  <span>${source.name}</span>
                </div>
              </div>

              <div class="webgis-popup-title-box">
                <div class="webgis-popup-field-label">${fieldLabel}</div>
                <div class="webgis-popup-title-row">
                  <div 
                    class="webgis-popup-title-val webgis-copyable"
                    data-copy="${escapeHtml(String(title))}"
                    data-label="${escapeHtml(String(fieldLabel))}"
                    onclick="event.preventDefault(); event.stopPropagation(); window.copyPopupEl(this, event);"
                    onkeydown="window.handlePopupKeydown(this, event);"
                    tabindex="0"
                    role="button"
                    title="Clique para copiar ${escapeHtml(String(fieldLabel))}"
                  >
                    <span class="webgis-copy-original">${title}</span>
                    <span class="webgis-copy-feedback">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span>Copiado</span>
                    </span>
                  </div>
                </div>
              </div>

              ${extraInfoHtml}
              ${searchPolygonBtnHtml}
            </div>
          `;

          (layer as any)._popupContentHtml = popupContentHtml;

          // Se for camada de ponto (que não seja polígono nem Localidades com balão Apple Maps), mantém o popup padrão anexado
          if (!isPolygon && !isAreaLayer && source.name !== "Localidades (Piauí)") {
            layer.bindPopup(popupContentHtml);
          }

          // Clique na feição
          // Botão direito na feição -> Dispara o evento de contextmenu no mapa para fixar o pino na coordenada exata
          layer.on('contextmenu', (ev: L.LeafletMouseEvent) => {
            if (ev.originalEvent) {
              L.DomEvent.stopPropagation(ev.originalEvent);
              L.DomEvent.preventDefault(ev.originalEvent);
            }
            if (mapRef.current) {
              mapRef.current.fire('contextmenu', ev);
            }
          });

          layer.on('click', (ev: L.LeafletMouseEvent) => {
            try {
              // Somente cliques com botão esquerdo (botão 0). Ignora qualquer clique com botão direito ou meio
              if (ev.originalEvent && ev.originalEvent.button !== 0) {
                return;
              }
              // Se a ferramenta de medição estiver ativa, repassa o clique diretamente para o controle de medição
              // permitindo marcar pontos sobre qualquer camada, polígono ou feição
              if (isMeasuringActiveRef.current) {
                const mc = (mapRef.current as any)?.measureControl;
                if (mc && typeof mc._handleMeasureClick === 'function') {
                  mc._handleMeasureClick(ev);
                }
                return;
              }
              const measuringPrompt = document.querySelector('.js-measuringprompt') as HTMLElement;
              if (measuringPrompt && measuringPrompt.style.display !== 'none') {
                const mc = (mapRef.current as any)?.measureControl;
                if (mc && typeof mc._handleMeasureClick === 'function') {
                  mc._handleMeasureClick(ev);
                }
                return;
              }

              L.DomEvent.stopPropagation(ev);

              // REGRA DE DESSELEÇÃO LIMPA E SEGURA:
              // Se há alguma localidade selecionada e o usuário clicou em uma feição
              // que NÃO é da camada de localidades (ex: Município, Bairro, etc.):
              // O primeiro clique APENAS desseleciona a localidade e fecha qualquer balão!
              // Não abre o balão nem seleciona o município/bairro diretamente.
              const hasSelectedLocalidade = selectedFeaturesRef.current.some(
                f => f.sourceName === "Localidades (Piauí)"
              );
              const isCurrentClickLocalidade = source.name === "Localidades (Piauí)";

              if (hasSelectedLocalidade && !isCurrentClickLocalidade) {
                clearPolygonCallout();
                onSelectionChangeRef.current?.([]);
                return;
              }

              // Para feições poligonais, enquadra o polígono e abre o Balão Callout Lateral com linha conectora a partir da borda
              if (isPolygon || isAreaLayer) {
                openPolygonCallout(layer, popupContentHtml, ev.latlng, false);
              }

              const isCtrl = ev.originalEvent ? (ev.originalEvent.ctrlKey || ev.originalEvent.metaKey) : false;
              const multi = isCtrl || isMultiSelectModeRef.current;

              onSelectionChangeRef.current?.((prevSelected) => {
                const alreadySelected = prevSelected.some(item => 
                  item.id === String(layer._leaflet_id) ||
                  item.layer === layer ||
                  (Boolean((layer as any).localidadeKey) && (item.layer as any)?.localidadeKey === (layer as any).localidadeKey)
                );

                if (multi) {
                  if (alreadySelected) {
                    // Remove da seleção múltipla
                    applySelectedStyleToLayer(layer, false);
                    return prevSelected.filter(item => 
                      item.id !== String(layer._leaflet_id) &&
                      item.layer !== layer &&
                      (!Boolean((layer as any).localidadeKey) || (item.layer as any)?.localidadeKey !== (layer as any).localidadeKey)
                    );
                  } else {
                    // Adiciona à seleção múltipla
                    applySelectedStyleToLayer(layer, true);
                    const newFeat: SelectedFeature = {
                      id: String(layer._leaflet_id),
                      name: title,
                      sourceName: source.name,
                      layer: layer,
                      properties: props
                    };
                    return [...prevSelected, newFeat];
                  }
                } else {
                  // Seleção simples: desmarca as anteriores com segurança
                  prevSelected.forEach(item => {
                    if (item.layer) {
                      applySelectedStyleToLayer(item.layer, false);
                    }
                  });

                  if (alreadySelected) {
                    applySelectedStyleToLayer(layer, false);
                    clearPolygonCallout();
                    return [];
                  } else {
                    applySelectedStyleToLayer(layer, true);
                    return [{
                      id: String(layer._leaflet_id),
                      name: title,
                      sourceName: source.name,
                      layer: layer,
                      properties: props
                    }];
                  }
                }
              });
            } catch (err) {
              console.error('Erro ao processar clique na feição:', err);
            }
          });
        }
      };

      let leafletLayer: L.GeoJSON;

      // Se for a camada de Localidades (Pontos), usar Rótulos e Balões Estilo Apple Maps (maps.apple.com)
      if (source.name === "Localidades (Piauí)") {
        const allMarkers: any[] = [];
        const minZoomMap = computeSpatialMinZooms(data.features || []);

        geojsonOptions.pointToLayer = (feature, latlng) => {
          const minZoom = minZoomMap.get(feature) ?? 12;
          const props = feature?.properties || {};
          const rawName = props.Localidade || props.NM_LOCALIDA || props.name || props.Nome || props.NM_MUN || props.NM_AGLOM || getIdentifier(props);
          const name = toTitleCase(String(getTranslatedValue('Localidade', rawName) || rawName || 'Localidade').trim());

          const customColor = layerColorsRef.current[source.name] || '#FF3B30';
          const initialZoom = mapRef.current ? mapRef.current.getZoom() : 8;

          const locKey = getLocalidadeFeatureKey(props, latlng);
          const isSelected = selectedFeaturesRef.current.some(f => {
            if (f.sourceName !== "Localidades (Piauí)") return false;
            const featKey = (f.layer as any)?.localidadeKey || getLocalidadeFeatureKey(f.properties, (f.layer as any)?.featureLatLng);
            return locKey && featKey ? locKey === featKey : false;
          });

          const icon = createAppleMapsLocalidadeIcon(name, initialZoom, isSelected, customColor);
          const marker = L.marker(latlng, { icon, pane: 'markerPane' }) as any;
          marker.minZoom = minZoom;
          marker.featureName = name;
          marker.featureLatLng = latlng;
          marker.featureProps = props;
          marker.localidadeKey = locKey;
          marker.customSourceName = source.name;
          if (isSelected) {
            marker.setZIndexOffset(100000);
          }
          allMarkers.push(marker);
          return marker;
        };

        leafletLayer = L.geoJSON(data, geojsonOptions);
        // Ordena por relevância (minZoom menor tem prioridade na tela)
        allMarkers.sort((a, b) => (a.minZoom || 14) - (b.minZoom || 14));
        (leafletLayer as any).allMarkers = allMarkers;
        (leafletLayer as any).customSourceName = source.name;

        // Filtrar de acordo com a VIEWPORT visível no zoom atual do mapa
        if (mapRef.current) {
          const customColor = layerColorsRef.current[source.name] || '#FF3B30';
          updateLocalidadesViewport(leafletLayer, mapRef.current, selectedFeaturesRef.current, customColor);
        }
      } else {
        leafletLayer = L.geoJSON(data, geojsonOptions);
        (leafletLayer as any).customSourceName = source.name;
      }

      if (!searchParams) {
        loadedLayersRef.current[source.name] = leafletLayer;
      }
      
      setStatusText(`Camada ${source.name} pronta.`);
      return leafletLayer;
    } catch (err) {
      console.error(err);
      showToast(`Erro ao carregar a camada ${source.name}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Alternar visibilidade de uma camada no painel de Camadas Ativas (mantém na lista de ativas mesmo se desativada)
  const toggleLayerVisibility = (sourceName: string) => {
    setVisibleLayers(prev => {
      const isCurrentlyVisible = prev[sourceName] !== false;
      const nextVisible = !isCurrentlyVisible;
      if (!nextVisible) {
        onSelectionChangeRef.current?.((prevSel) => prevSel.filter(f => f.sourceName !== sourceName));
      }
      return { ...prev, [sourceName]: nextVisible };
    });
  };

  // Ativar uma camada inativa (adiciona ao topo da lista de Camadas Ativas, liga visibilidade e expande)
  const activateLayer = (sourceName: string) => {
    if (allowedLayerNames && !allowedLayerNames.includes(sourceName)) {
      showToast(`Você não possui permissão de acesso para a camada "${sourceName}".`);
      return;
    }
    if (!activeLayers.includes(sourceName)) {
      setActiveLayers([sourceName, ...activeLayers]);
    }
    setVisibleLayers(prev => ({ ...prev, [sourceName]: true }));
    setExpandedDetails(prev => ({ ...prev, [sourceName]: true }));
  };

  // Remover definitivamente uma camada das Camadas Ativas (envia de volta para Camadas Inativas e recolhe/desexpande)
  const removeLayerFromActive = (sourceName: string) => {
    setActiveLayers(activeLayers.filter(name => name !== sourceName));
    setExpandedDetails(prev => ({ ...prev, [sourceName]: false }));
    onSelectionChangeRef.current?.((prevSel) => prevSel.filter(f => f.sourceName !== sourceName));
    showToast(`Camada "${sourceName}" removida das camadas ativas.`);
  };

  // Abrir Modal de Salvar Estilo
  const openSaveStyleModal = () => {
    setStyleNameInput(`Estilo ${savedStyles.length + 1}`);
    setOverwriteStyleId(null);
    setShowSaveModal(true);
    setShowLoadDropdown(false);
  };

  // Confirmar Salvamento do Estilo Personalizado
  const handleConfirmSaveStyle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = styleNameInput.trim() || `Estilo ${savedStyles.length + 1}`;

    try {
      const newPreset: SavedStylePreset = {
        id: overwriteStyleId || `preset_${Date.now()}`,
        name: finalName,
        activeLayers: [...activeLayers],
        visibleLayers: { ...visibleLayers },
        layerOpacities: { ...layerOpacities },
        layerColorsState: { ...layerColorsState },
        layerStrokeColorsState: { ...layerStrokeColorsState },
        basemap,
        savedAt: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      };

      let updatedList: SavedStylePreset[];
      if (overwriteStyleId) {
        updatedList = savedStyles.map(s => s.id === overwriteStyleId ? newPreset : s);
      } else if (savedStyles.length >= 4) {
        showToast('Você atingiu o limite de 4 estilos. Selecione um estilo existente para sobrescrever.');
        return;
      } else {
        updatedList = [newPreset, ...savedStyles];
      }

      setSavedStyles(updatedList);
      localStorage.setItem('webgis_saved_styles', JSON.stringify(updatedList));
      showToast(`✨ Estilo "${finalName}" salvo com sucesso! (${updatedList.length}/4)`);
      setShowSaveModal(false);
      setOverwriteStyleId(null);
    } catch (err) {
      console.error('Erro ao salvar estilo:', err);
      showToast('Erro ao salvar estilo no navegador.');
    }
  };

  // Aplicar um Estilo Salvo
  const applySavedStyle = (preset: SavedStylePreset) => {
    try {
      if (preset.activeLayers && Array.isArray(preset.activeLayers)) {
        setActiveLayers(preset.activeLayers);
      }
      if (preset.visibleLayers) {
        setVisibleLayers(preset.visibleLayers);
      }
      const newOpacities = preset.layerOpacities || {};
      const newColors = preset.layerColorsState || {};
      const newStrokeColors = preset.layerStrokeColorsState || {};

      setLayerOpacities(newOpacities);
      setLayerColorsState(newColors);
      layerColorsRef.current = newColors;
      setLayerStrokeColorsState(newStrokeColors);
      layerStrokeColorsRef.current = newStrokeColors;

      if (preset.basemap) {
        setBasemap(preset.basemap);
      }

      // Atualizar visualmente as camadas que já estão carregadas no mapa
      dataSources.forEach(source => {
        const layer = loadedLayersRef.current[source.name];
        if (layer) {
          const defaultColor = getLayerColor(source.name);
          const color = newColors[source.name] || defaultColor;
          const strokeColor = newStrokeColors[source.name] || "#000000";
          const opacity = newOpacities[source.name] ?? (source.name === "Localidades (Piauí)" ? 0.5 : 0.1);

          layer.eachLayer((lyr: any) => {
            if (lyr.defaultStyle) {
              lyr.defaultStyle.fillColor = color;
              lyr.defaultStyle.color = strokeColor;
              lyr.defaultStyle.fillOpacity = opacity;
            }
            if (typeof lyr.setStyle === 'function') {
              lyr.setStyle({
                fillColor: color,
                color: strokeColor,
                fillOpacity: opacity
              });
            }
          });
        }
      });

      showToast(`✨ Estilo "${preset.name}" aplicado com sucesso!`);
      setShowLoadDropdown(false);
    } catch (err) {
      console.error('Erro ao aplicar estilo:', err);
      showToast('Erro ao aplicar estilo salvo.');
    }
  };

  // Excluir um Estilo Salvo
  const deleteSavedStyle = (id: string, name: string) => {
    const updatedList = savedStyles.filter(s => s.id !== id);
    setSavedStyles(updatedList);
    localStorage.setItem('webgis_saved_styles', JSON.stringify(updatedList));
    showToast(`Estilo "${name}" excluído.`);
  };

  // Resetar Estilo e Configurações para os Padrões de Fábrica
  const resetToDefaultStyle = () => {
    setActiveLayers([
      'Localidades (Piauí)',
      'Núcleos Urbanos',
      'Comunidades Rurais de Teresina',
      'Aglomerados Rurais',
      'Favelas e Comunidades',
      'Bairros',
      'Municipios'
    ]);
    setVisibleLayers({});
    const defaultExpanded: Record<string, boolean> = {};
    [
      'Localidades (Piauí)',
      'Núcleos Urbanos',
      'Comunidades Rurais de Teresina',
      'Aglomerados Rurais',
      'Favelas e Comunidades',
      'Bairros',
      'Municipios'
    ].forEach(name => {
      defaultExpanded[name] = true;
    });
    setExpandedDetails(defaultExpanded);
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    setBasemap(isDark ? 'appleDark' : 'apple');
    onSelectionChangeRef.current?.([]);

    const initialOpacities: Record<string, number> = {};
    dataSources.forEach(s => { 
      initialOpacities[s.name] = s.name === "Localidades (Piauí)" ? 0.88 : (s.name === "Municipios" ? 0 : 0.14); 
    });
    setLayerOpacities(initialOpacities);
    setLayerColorsState({});
    layerColorsRef.current = {};
    setLayerStrokeColorsState({});
    layerStrokeColorsRef.current = {};

    // Atualizar visualmente todas as camadas já carregadas no Leaflet para os valores padrões
    dataSources.forEach(source => {
      const layer = loadedLayersRef.current[source.name];
      if (layer) {
        const defaultColor = getLayerColor(source.name);
        const defaultOpacity = source.name === "Localidades (Piauí)" ? 0.5 : (source.name === "Municipios" ? 0 : 0.1);

        const updateLyrStyle = (lyr: any) => {
          const originalStyle = typeof source.style === 'function' ? source.style(lyr.feature) : source.style;
          const baseFillColor = originalStyle?.fillColor || defaultColor;
          const baseStrokeColor = originalStyle?.color || defaultColor;

          if (lyr.defaultStyle) {
            lyr.defaultStyle.fillColor = baseFillColor;
            lyr.defaultStyle.color = baseStrokeColor;
            lyr.defaultStyle.fillOpacity = defaultOpacity;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({
              fillColor: baseFillColor,
              color: baseStrokeColor,
              fillOpacity: defaultOpacity
            });
          }
        };

        const markersToUpdate = (layer as any).allMarkers || [];
        if (markersToUpdate.length > 0) {
          markersToUpdate.forEach(updateLyrStyle);
        }
        layer.eachLayer(updateLyrStyle);
      }
    });

    showToast('Configurações redefinidas para o padrão de fábrica.');
  };

  // Mover camada ativa para cima na lista
  const moveLayerUp = (sourceName: string) => {
    const index = activeLayers.indexOf(sourceName);
    if (index <= 0) return;
    const updated = [...activeLayers];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setActiveLayers(updated);
  };

  // Mover camada ativa para baixo na lista
  const moveLayerDown = (sourceName: string) => {
    const index = activeLayers.indexOf(sourceName);
    if (index < 0 || index >= activeLayers.length - 1) return;
    const updated = [...activeLayers];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setActiveLayers(updated);
  };

  // Ajustar opacidade de uma camada
  const handleOpacityChange = (sourceName: string, opacity: number) => {
    setLayerOpacities(prev => ({ ...prev, [sourceName]: opacity }));
    const layer = loadedLayersRef.current[sourceName];
    if (layer) {
      const markersToUpdate = (layer as any).allMarkers || [];
      if (markersToUpdate.length > 0) {
        markersToUpdate.forEach((lyr: any) => {
          if (lyr.defaultStyle) {
            lyr.defaultStyle.fillOpacity = opacity;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ fillOpacity: opacity });
          }
        });
      } else {
        layer.eachLayer((lyr: any) => {
          if (lyr.defaultStyle) {
            lyr.defaultStyle.fillOpacity = opacity;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ fillOpacity: opacity });
          }
        });
      }
    }
  };

  // Ajustar cor de uma camada (Preenchimento)
  const handleColorChange = (sourceName: string, color: string) => {
    setLayerColorsState(prev => ({ ...prev, [sourceName]: color }));
    layerColorsRef.current[sourceName] = color;
    const layer = loadedLayersRef.current[sourceName];
    if (layer) {
      const markersToUpdate = (layer as any).allMarkers || [];
      if (markersToUpdate.length > 0) {
        if (mapRef.current) {
          updateLocalidadesViewport(layer, mapRef.current, selectedFeaturesRef.current, color);
        }
      } else {
        layer.eachLayer((lyr: any) => {
          if (lyr.defaultStyle) {
            lyr.defaultStyle.fillColor = color;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ fillColor: color });
          }
        });
      }
    }
  };

  // Ajustar cor de contorno (Stroke) de uma camada
  const handleStrokeColorChange = (sourceName: string, color: string) => {
    setLayerStrokeColorsState(prev => ({ ...prev, [sourceName]: color }));
    layerStrokeColorsRef.current[sourceName] = color;
    const layer = loadedLayersRef.current[sourceName];
    if (layer) {
      const markersToUpdate = (layer as any).allMarkers || [];
      if (markersToUpdate.length > 0) {
        markersToUpdate.forEach((lyr: any) => {
          if (lyr.defaultStyle) {
            lyr.defaultStyle.color = color;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ color: color });
          }
        });
      } else {
        layer.eachLayer((lyr: any) => {
          if (lyr.defaultStyle) {
            lyr.defaultStyle.color = color;
          }
          if (typeof lyr.setStyle === 'function') {
            lyr.setStyle({ color: color });
          }
        });
      }
    }
  };

  // Zoom para extensão total da camada
  const zoomToLayer = async (source: DataSource) => {
    try {
      const layer = await loadLayer(source);
      const map = mapRef.current;
      if (!map) return;

      activateLayer(source.name);

      if ((layer as any).allMarkers && Array.isArray((layer as any).allMarkers)) {
        const pts: L.LatLng[] = (layer as any).allMarkers.map((m: any) => m.getLatLng());
        if (pts.length > 0) {
          map.fitBounds(L.latLngBounds(pts).pad(0.05));
        }
      } else if (typeof (layer as any).getBounds === 'function') {
        const bounds = (layer as any).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.05));
        }
      } else {
        const pts: L.LatLng[] = [];
        layer.eachLayer((lyr: any) => {
          if (typeof lyr.getLatLng === 'function') {
            pts.push(lyr.getLatLng());
          }
        });
        if (pts.length > 0) {
          map.fitBounds(L.latLngBounds(pts).pad(0.05));
        }
      }
      showToast(`Enquadrando mapa em: ${source.name}`);
    } catch (err) {
      console.error(err);
      showToast('Não foi possível obter a extensão desta camada.');
    }
  };

  // Verifica se todas as camadas autorizadas já estão ativas e com visibilidade ligada
  const isAllLayersOn = useMemo(() => {
    const available = allowedLayerNames 
      ? dataSources.filter(s => allowedLayerNames.includes(s.name)).map(s => s.name)
      : dataSources.map(s => s.name);
    return available.length > 0 && available.every(name => activeLayers.includes(name) && visibleLayers[name] !== false);
  }, [allowedLayerNames, activeLayers, visibleLayers]);

  // Ligar Tudo (ativa todas as camadas e liga a visibilidade de todas)
  const handleTurnAllOn = () => {
    showToast('Ligando todas as camadas autorizadas...');
    const available = allowedLayerNames 
      ? dataSources.filter(s => allowedLayerNames.includes(s.name)).map(s => s.name)
      : dataSources.map(s => s.name);
    setActiveLayers(available);
    const newVisible: Record<string, boolean> = {};
    available.forEach(name => {
      newVisible[name] = true;
    });
    setVisibleLayers(prev => ({ ...prev, ...newVisible }));
  };

  // Desligar Tudo (mantém as camadas na lista e na legenda, apenas desativando a visibilidade)
  const handleTurnAllOff = () => {
    showToast('Desligando visibilidade de todas as camadas.');
    const newVisible: Record<string, boolean> = {};
    activeLayers.forEach(name => {
      newVisible[name] = false;
    });
    setVisibleLayers(prev => ({ ...prev, ...newVisible }));
    onSelectionChangeRef.current?.([]);
  };

  // Expandir / Recolher todos os accordions de camadas
  const toggleAllDetails = (open: boolean) => {
    const next: Record<string, boolean> = {};
    dataSources.forEach(s => {
      next[s.name] = open;
    });
    setExpandedDetails(next);
  };

  return (
    <div className={`w-full h-full relative select-none ${isPrintMode ? 'flex flex-col' : ''}`}>
      {/* Caixa do Mapa com Controles Absolutos (100% Fullscreen Estilo Apple Maps) */}
      <div className={`relative w-full h-full ${isPrintMode ? 'flex-1 min-h-[500px]' : ''}`}>
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          <div 
            ref={mapContainerRef} 
            id="map" 
            style={{ width: '100%', height: '100%', zIndex: 0 }}
            role="region" 
            aria-label="Mapa interativo"
          />
        </div>

        {/* BARRA FLUTUANTE DE MEDIÇÃO ATIVA NO MAPA (APPLE MAPS GLASS PILL) */}
        {!isPrintMode && activeMeasureInfo && (
          <div 
            ref={measureCardRef}
            className={`fixed z-[1100] bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-2xl shadow-xl border border-black/10 dark:border-white/10 flex items-center select-none text-xs max-w-[95vw] pointer-events-auto ${
              measureCardPos === null ? 'transition-all duration-300 ease-out' : ''
            } ${
              isMeasureCardMinimized ? 'px-2.5 py-1.5 gap-2' : 'px-3.5 py-2.5 flex-wrap gap-3 sm:max-w-md'
            }`}
            style={
              measureCardPos !== null
                ? { left: `${measureCardPos.x}px`, top: `${measureCardPos.y}px` }
                : { left: `${(isSidebarCollapsed ? 68 : 215) + (isStage2Open ? 390 : 0) + 16}px`, top: '4rem' }
            }
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {/* Alça de arrasto */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Alça de arrasto"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onDoubleClick={handleDragHandleDoubleClick}
              className="p-1 -ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing select-none shrink-0"
              title="Arrastar card (duplo clique para restaurar posição padrão)"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            {isMeasureCardMinimized ? (
              // MODO MINIMIZADO
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs shrink-0 border border-black/5 dark:border-white/5">
                  <Ruler className="w-3.5 h-3.5" />
                </span>
                <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {activeMeasureInfo.areaDisplay}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMeasureCardMinimized(false);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 cursor-pointer ml-0.5 transition-colors"
                  title="Expandir card de medição"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              // MODO EXPANDIDO
              <>
                <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-bold">
                  <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-700 dark:text-slate-200 text-sm shrink-0 border border-black/5 dark:border-white/5">
                    <Ruler className="w-4 h-4" />
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-extrabold text-slate-900 dark:text-white leading-tight">
                        {activeMeasureInfo.areaDisplay}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#64D2FF]">
                        Área
                      </span>
                    </div>
                    {activeMeasureInfo.lengthDisplay && (
                      <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                        Perímetro: {activeMeasureInfo.lengthDisplay}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const feat = buildMeasuredPolygonFeature(activeMeasureInfo);
                      if (feat && onSearchPolygonAddressesRef.current) {
                        onSearchPolygonAddressesRef.current({
                          feature: feat,
                          title: `Área Medida (${activeMeasureInfo.areaDisplay || 'Polígono'})`,
                          sourceName: 'Medição',
                          layer: null
                        });
                      }
                    }}
                    className="px-3 py-1.5 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    title="Buscar Endereços neste polígono medido"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar Endereços</span>
                  </button>

                  <div className="relative" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExportMenuOpen(prev => !prev);
                      }}
                      className="px-2.5 py-1.5 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                      title="Exportar polígono medido"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                      <span>Exportar</span>
                      <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isExportMenuOpen && (
                      <div 
                        className="absolute left-0 top-full mt-1.5 w-36 bg-white dark:bg-[#2c2c2e] rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1 z-50 animate-fadeIn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleExportMeasure('geojson')}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="font-semibold">GeoJSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportMeasure('kml')}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="font-semibold">KML</span>
                          <span className="text-[10px] text-slate-400">Earth</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportMeasure('csv')}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="font-semibold">CSV</span>
                          <span className="text-[10px] text-slate-400">Excel</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeMeasureInfo.layer && mapRef.current) {
                        if (typeof activeMeasureInfo.layer.bringToFront === 'function') {
                          activeMeasureInfo.layer.bringToFront();
                        }
                        if (typeof activeMeasureInfo.layer.getBounds === 'function') {
                          mapRef.current.fitBounds(activeMeasureInfo.layer.getBounds(), { padding: [30, 30], maxZoom: 17 });
                        }
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer transition-colors active:scale-95"
                    title="Centralizar no mapa e abrir balão"
                  >
                    <LocateFixed className="w-4 h-4 text-[#007AFF]" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearMeasurement();
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] dark:text-[#FF453A] rounded-xl font-bold cursor-pointer transition-colors active:scale-95"
                    title="Apagar / Limpar Medição do Mapa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMeasureCardMinimized(true);
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-slate-500 dark:text-slate-400 rounded-xl cursor-pointer transition-colors active:scale-95"
                    title="Minimizar card de medição"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* LEGENDA CARTOGRÁFICA DO MAPA (ESTILO APPLE MAPS / iOS CAPSULE) */}
        {!isPrintMode ? (
          <div 
            className="absolute z-[990] flex flex-col items-start print:hidden select-none transition-all duration-300 ease-out"
            style={{
              left: isStage2Open ? 'calc(390px + 14px)' : '14px',
              bottom: !isBottomBarOpen 
                ? '16px' 
                : isBottomBarExpanded 
                  ? 'calc(var(--cnefe-bottom-height, 46vh) + 14px)'
                  : '58px'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {!isLegendOpen ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLegendOpen(true);
                }}
                className="bg-white/85 dark:bg-[#1c1c1e]/85 hover:bg-white dark:hover:bg-[#2c2c2e] text-slate-800 dark:text-slate-100 font-extrabold text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-2xl transition-all flex items-center gap-2 cursor-pointer group active:scale-95"
                title="Expandir Legenda Temática do Mapa"
              >
                <Layers className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0a84ff] shrink-0" />
                <span className="tracking-tight">Legenda</span>
                <span className="bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  {activeVisibleLayers.length}
                </span>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform" />
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ duration: 0.2 }}
                className="bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 w-[240px] sm:w-[270px] overflow-hidden flex flex-col transition-all"
              >
                {/* Cabeçalho da Legenda */}
                <div className="px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.04] border-b border-black/5 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#007AFF] dark:text-[#0a84ff] shrink-0" />
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Legenda
                    </span>
                    <span className="text-[9px] bg-blue-100 dark:bg-blue-950/80 text-[#007AFF] dark:text-[#0a84ff] font-extrabold px-1.5 py-0.2 rounded-full">
                      {activeVisibleLayers.length} {activeVisibleLayers.length === 1 ? 'ativa' : 'ativas'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLegendOpen(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                    title="Minimizar legenda"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Lista de Feições e Camadas da Legenda */}
                <div className="p-2 max-h-52 overflow-y-auto custom-scrollbar space-y-1.5 text-left">
                  {activeVisibleLayers.length === 0 ? (
                    <div className="p-2.5 text-center text-slate-400 dark:text-slate-500 text-[11px] italic font-medium">
                      Nenhuma feição nesta área visível do mapa.
                    </div>
                  ) : (
                    activeVisibleLayers.map(item => (
                      <div
                        key={item.name}
                        className={`flex items-center gap-2 p-1.5 rounded-xl transition-all ${
                          item.isVisible 
                            ? 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70' 
                            : 'opacity-50 bg-slate-50/60 dark:bg-slate-800/40 hover:opacity-75'
                        }`}
                      >
                        {/* Símbolo Cartográfico (Ponto ou Polígono) */}
                        {item.isPointLayer ? (
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={item.fillColor} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5 drop-shadow-sm">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"></circle>
                            </svg>
                          </div>
                        ) : (
                          <div
                            className="w-5 h-3.5 rounded-xs shrink-0 shadow-xs transition-all relative overflow-hidden flex items-center justify-center"
                            style={{
                              backgroundColor: item.opacity <= 0 
                                ? 'transparent' 
                                : (item.fillColor.startsWith('#') && item.fillColor.length === 7
                                    ? `rgba(${parseInt(item.fillColor.slice(1, 3), 16)}, ${parseInt(item.fillColor.slice(3, 5), 16)}, ${parseInt(item.fillColor.slice(5, 7), 16)}, ${Math.max(0.12, item.opacity)})`
                                    : item.fillColor),
                              border: `2px solid ${item.strokeColor || item.fillColor}`,
                            }}
                            title={`Preenchimento: ${item.fillColor} (${Math.round(item.opacity * 100)}%), Borda: ${item.strokeColor || item.fillColor}`}
                          >
                            {item.opacity <= 0 && (
                              <div className="w-full h-full opacity-10 bg-current" style={{ color: item.strokeColor || item.fillColor }} />
                            )}
                          </div>
                        )}

                        {/* Rótulo da Camada */}
                        <div className="min-w-0 flex-1">
                          <div className={`text-[11px] font-bold truncate ${item.isVisible ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} title={item.name}>
                            {item.name}
                          </div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                            {!item.isVisible ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">Desativada</span>
                            ) : item.isPointLayer ? (
                              (mapRef.current && mapRef.current.getZoom() < 8) ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">Aproxime o zoom (≥ 8)</span>
                              ) : item.featureCount === 0 ? (
                                'Nenhuma localidade na tela'
                              ) : (
                                `${item.featureCount} localidade(s) visível(is)` 
                              )
                            ) : (
                              item.opacity <= 0 
                                ? (item.featureCount === 0 ? 'Polígono (Limites) • Fora da tela' : `Polígono (Limites) • ${item.featureCount} no enquadramento`)
                                : (item.featureCount === 0 ? 'Polígono • Fora da tela' : `Polígono • ${item.featureCount} na área visível`)
                            )}
                          </div>
                        </div>

                        {/* Botão de Ativação / Desativação da Camada (Olho) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleLayerVisibility(item.name);
                            showToast(item.isVisible ? `Camada "${item.name}" desativada.` : `Camada "${item.name}" ativada!`);
                          }}
                          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            item.isVisible
                              ? 'text-slate-500 hover:text-red-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                          }`}
                          title={item.isVisible ? `Desativar camada ${item.name}` : `Ativar camada ${item.name}`}
                        >
                          {item.isVisible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </div>
        ) : (
          /* LEGENDA NO MODO IMPRESSÃO A4 (FORMATO CARTOGRÁFICO FORMAL) */
          <div className="absolute bottom-2 left-2 z-[990] bg-white border-2 border-black p-2 rounded shadow-none text-black select-none max-w-[240px]">
            <div className="text-[10px] font-black uppercase tracking-wider border-b border-black pb-1 mb-1.5 flex items-center justify-between">
              <span>LEGENDA</span>
              <span className="text-[8px] font-bold">({activeVisibleLayers.length})</span>
            </div>
            <div className="space-y-1">
              {activeVisibleLayers.map(item => (
                <div key={item.name} className="flex items-center gap-1.5 text-[9px] font-bold">
                  {item.isPointLayer ? (
                    <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={item.fillColor} stroke="#000000" strokeWidth="1.5" className="w-3 h-3">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"></circle>
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="w-3.5 h-2.5 border border-black shrink-0"
                      style={{
                        backgroundColor: item.fillColor,
                        opacity: Math.max(0.3, item.opacity)
                      }}
                    />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apple Maps Legal Bar no Canto Inferior Direito */}
        {!isPrintMode && (
          <div 
            className="absolute right-3 z-[900] select-none pointer-events-none flex items-center gap-2 text-[10px] text-slate-500/80 dark:text-slate-400/80 font-medium px-2.5 py-0.5 rounded-full bg-white/60 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 transition-all duration-300 ease-out"
            style={{
              bottom: !isBottomBarOpen 
                ? '8px' 
                : isBottomBarExpanded 
                  ? 'calc(var(--cnefe-bottom-height, 46vh) + 10px)'
                  : '54px'
            }}
          >
            <span>Termos</span>
            <span>•</span>
            <span>Legal</span>
            <span>•</span>
            <span>Dados IBGE / SSP-PI</span>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div id="loading-overlay" className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-[1000] rounded-2xl">
            <div className="text-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
              <svg className="animate-spin h-9 w-9 text-red-700 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p id="status" className="text-slate-700 dark:text-slate-300 mt-3 text-sm font-bold" role="status" aria-live="polite">
                {statusText}
              </p>
            </div>
          </div>
        )}

        {/* CARD FLUTUANTE DE MEDIÇÃO APPLE MAPS (MAPS.APPLE.COM) */}
        {isMeasuringActive && !isPrintMode && (
          <div 
            className="absolute top-16 right-16 max-sm:top-16 max-sm:left-3 max-sm:right-3 max-sm:w-auto z-[995] w-[330px] max-w-[calc(100vw-88px)] bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 p-4 space-y-3 text-left transition-all select-none animate-fadeIn"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF9500] to-[#FF5E3A] flex items-center justify-center text-white shadow-md shadow-orange-500/25 shrink-0">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
                    Medir Distâncias e Áreas
                  </h3>
                  <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                    {pointCount === 0 
                      ? 'Pronto para medir' 
                      : `${pointCount} ${pointCount === 1 ? 'vértice marcado' : 'vértices marcados'}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelMeasure}
                className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-500 hover:text-black dark:text-slate-300 dark:hover:text-white transition-all cursor-pointer"
                title="Fechar medição"
                aria-label="Fechar medição"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dica / Status */}
            <div className="px-3 py-2 rounded-2xl bg-[#007AFF]/10 dark:bg-[#007AFF]/20 border border-[#007AFF]/20 text-[11.5px] font-semibold text-[#007AFF] dark:text-[#64D2FF] flex items-center gap-2">
              <span className="text-xs shrink-0">📍</span>
              <span className="leading-snug">
                {pointCount === 0 && "Toque ou clique no mapa para fixar o ponto inicial."}
                {pointCount === 1 && "Clique no mapa para marcar o próximo ponto da distância."}
                {pointCount === 2 && "Distância medida! Continue marcando pontos para calcular a área."}
                {pointCount >= 3 && "Área e perímetro calculados em tempo real na tela."}
              </span>
            </div>

            {/* Cards de Métricas em Tempo Real (KPIs Apple SF) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Distância Total
                </span>
                <div className="mt-1">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {pointCount >= 2 ? formatDistance(totalDistanceMeters) : '0 m'}
                  </span>
                  {pointCount >= 2 && totalDistanceMeters >= 1000 && (
                    <div className="text-[10px] text-slate-400 font-medium">
                      {Math.round(totalDistanceMeters).toLocaleString('pt-BR')} metros
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/5 flex flex-col justify-between">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Área Calculada
                </span>
                <div className="mt-1">
                  <span className={`text-base font-extrabold tracking-tight ${pointCount >= 3 ? 'text-[#34C759] dark:text-[#30d158]' : 'text-slate-400 dark:text-slate-500'}`}>
                    {pointCount >= 3 ? formatArea(totalAreaSqMeters).formatted : '—'}
                  </span>
                  {pointCount >= 3 && formatArea(totalAreaSqMeters).secondary && (
                    <div className="text-[10px] text-slate-400 font-medium">
                      {formatArea(totalAreaSqMeters).secondary}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Histórico Rolante de Vértices */}
            {pointCount > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                    Pontos de Marcação ({pointCount})
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-mono">
                    {measurePoints[pointCount - 1].lat.toFixed(4)}, {measurePoints[pointCount - 1].lng.toFixed(4)}
                  </span>
                </div>
                
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {measurePoints.map((pt, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.03] dark:border-white/[0.04] text-[10.5px] group hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-200 truncate">
                        <span className="w-4 h-4 rounded-full bg-[#007AFF]/15 text-[#007AFF] dark:text-[#64D2FF] font-black text-[9px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="truncate">
                          {pt.lat.toFixed(5)}&deg;, {pt.lng.toFixed(5)}&deg;
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMeasurePoint(i)}
                        className="text-slate-400 hover:text-[#FF3B30] p-1 rounded-lg transition-all cursor-pointer opacity-40 group-hover:opacity-100 hover:bg-red-500/10"
                        title="Excluir este ponto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botões de Ação na Base */}
            <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={handleCancelMeasure}
                className="flex-1 py-2 px-3 rounded-2xl bg-black/[0.05] dark:bg-white/10 hover:bg-red-500/10 text-slate-700 dark:text-slate-200 hover:text-[#FF3B30] dark:hover:text-[#FF453A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>

              <button
                type="button"
                disabled={pointCount < 2}
                onClick={handleFinishMeasure}
                className={`flex-1 py-2 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  pointCount >= 2 
                    ? 'bg-gradient-to-r from-[#007AFF] to-[#0062cc] text-white shadow-md shadow-blue-500/30 hover:brightness-110 active:scale-95' 
                    : 'bg-black/5 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        )}

        {/* CONTROLES FLUTUANTES ESTILO APPLE MAPS (MAPS.APPLE.COM) SOBREPOSTOS NO MAPA */}
        {(() => {
          const controlsContent = (
            <div id="custom-map-controls" className={isPrintMode ? "flex flex-col gap-4 w-full" : "absolute top-3 right-3 z-[999] flex flex-col items-end gap-2.5 print:hidden"}>
              
              {/* Barra Superior de Botões Flutuantes (Apple Squircle Pills) */}
              <div className="flex items-center gap-2">
                {/* 1. Seletor de Mapa Estilo Apple (Segmented Sheet Trigger) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setBasemapModalOpen(!basemapModalOpen);
                      setLayersPanelOpen(false);
                    }}
                    className={`h-10 px-3.5 rounded-2xl flex items-center gap-2 border text-xs font-bold transition-all shadow-xl backdrop-blur-2xl cursor-pointer ${
                      basemapModalOpen 
                        ? 'bg-[#007AFF] text-white border-[#0066d6] shadow-blue-500/25' 
                        : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title="Alternar estilo do mapa (Apple Maps)"
                  >
                    <MapIcon className="w-4 h-4 text-[#007AFF] dark:text-[#0a84ff]" />
                    <span className="hidden sm:inline">
                      {basemap === 'apple' ? ' Explorar' : basemap === 'appleDark' ? ' Escuro' : basemap === 'googleSat' ? 'Satélite' : basemap === 'googleHybrid' ? 'Híbrido' : 'Mapa'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${basemapModalOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Popover Apple com Segmented Controls para Basemaps */}
                  {basemapModalOpen && (
                    <div 
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      className="absolute right-0 top-12 w-[270px] p-2.5 bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 z-[1001] animate-fadeIn space-y-2 text-left"
                    >
                      <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                        Estilo do Mapa (Apple Maps)
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/5 dark:bg-white/5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => { setBasemap('apple'); setBasemapModalOpen(false); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            basemap === 'apple'
                              ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span className="text-sm"></span>
                          <span>Explorar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setBasemap('appleDark'); setBasemapModalOpen(false); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            basemap === 'appleDark'
                              ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span className="text-sm">🌙</span>
                          <span>Escuro</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setBasemap('googleSat'); setBasemapModalOpen(false); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            basemap === 'googleSat'
                              ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span className="text-sm">🛰️</span>
                          <span>Satélite</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setBasemap('googleHybrid'); setBasemapModalOpen(false); }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            basemap === 'googleHybrid'
                              ? 'bg-white dark:bg-[#2c2c2e] text-[#007AFF] dark:text-[#0a84ff] shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:text-black dark:hover:text-white'
                          }`}
                        >
                          <span className="text-sm">🗺️</span>
                          <span>Híbrido</span>
                        </button>
                      </div>

                      <div className="pt-1.5 border-t border-black/5 dark:border-white/10 flex justify-between items-center text-[11px] text-slate-500 px-1">
                        <span>Outros Provedores:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setBasemap('osm'); setBasemapModalOpen(false); }}
                            className={`font-bold hover:underline cursor-pointer ${basemap === 'osm' ? 'text-[#007AFF]' : ''}`}
                          >
                            OSM
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => { setBasemap('esri'); setBasemapModalOpen(false); }}
                            className={`font-bold hover:underline cursor-pointer ${basemap === 'esri' ? 'text-[#007AFF]' : ''}`}
                          >
                            Esri
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Botão Multiseleção Estilo Apple */}
                <button 
                  type="button"
                  id="btn-multi-select" 
                  onClick={onToggleMultiSelect}
                  className={`h-10 px-3.5 rounded-2xl flex items-center gap-1.5 border text-xs font-bold transition-all shadow-xl backdrop-blur-2xl cursor-pointer ${
                    isMultiSelectMode 
                      ? 'bg-[#007AFF] text-white border-[#0066d6] shadow-blue-500/25' 
                      : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  title="Permite selecionar várias áreas tocando nelas sem precisar do teclado"
                >
                  <MousePointerClick className="w-4 h-4" />
                  <span className="hidden sm:inline">Multiseleção: {isMultiSelectMode ? 'ON' : 'OFF'}</span>
                </button>

                {/* 2.1. Botão Dissolver Feições Poligonais (visível com 2+ polígonos selecionados) */}
                {selectedPolygonCount >= 2 && (
                  <button
                    type="button"
                    id="btn-dissolve"
                    onClick={handleToggleDissolve}
                    disabled={isDissolving}
                    className={`h-10 px-3.5 rounded-2xl flex items-center gap-1.5 border text-xs font-bold transition-all shadow-xl backdrop-blur-2xl cursor-pointer ${
                      isDissolved
                        ? 'bg-[#007AFF] text-white border-[#0066d6] shadow-blue-500/25'
                        : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title={isDissolved ? "Desfazer união dos polígonos selecionados" : "Unir os polígonos selecionados em contorno único"}
                  >
                    {isDissolving ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <Combine className="w-4 h-4 shrink-0" />
                    )}
                    <span className="hidden sm:inline">{isDissolved ? 'Desfazer dissolução' : 'Dissolver'}</span>
                    <span className="sm:hidden">{isDissolved ? 'Desfazer' : 'Dissolver'}</span>
                  </button>
                )}

                {/* 3. Botão de Camadas Estilo Apple (Floating Pill) */}
                {allowLayerPanel && (
                  <button 
                    onClick={() => {
                      setLayersPanelOpen(!layersPanelOpen);
                      setBasemapModalOpen(false);
                    }}
                    className={`h-10 px-3.5 rounded-2xl flex items-center gap-2 border text-xs font-bold transition-all shadow-xl backdrop-blur-2xl cursor-pointer ${
                      layersPanelOpen 
                        ? 'bg-[#007AFF] text-white border-[#0066d6] shadow-blue-500/25' 
                        : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    title="Alternar painel de camadas"
                    aria-expanded={layersPanelOpen}
                  >
                    <Layers className="w-4 h-4" />
                    <span className="hidden sm:inline">Camadas</span>
                  </button>
                )}
              </div>

              {/* 3. Coluna de Controles Flutuantes à Direita (Pills de Ação Rápida Apple) */}
              <div className="flex flex-col items-center gap-2 mt-1">
                {/* Zoom Pill Vertical Estilo Apple */}
                <div className="flex flex-col rounded-2xl overflow-hidden shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-2xl bg-white/85 dark:bg-[#1c1c1e]/85">
                  <button 
                    type="button"
                    onClick={() => mapRef.current?.zoomIn()} 
                    className="w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                    title="Aproximar Zoom (Apple Maps)"
                    aria-label="Aproximar Zoom"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <div className="h-[0.5px] w-6 mx-auto bg-black/10 dark:bg-white/15" />
                  <button 
                    type="button"
                    onClick={() => mapRef.current?.zoomOut()} 
                    className="w-10 h-10 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                    title="Afastar Zoom (Apple Maps)"
                    aria-label="Afastar Zoom"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                {/* Ferramenta de Medir Distâncias e Áreas (Estilo Apple Maps) */}
                {allowMeasureTool && (
                  <button 
                    type="button"
                    id="btn-toggle-measure"
                    onClick={handleToggleMeasure}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-2xl transition-all cursor-pointer ${
                      isMeasuringActive 
                        ? 'bg-[#007AFF] text-white shadow-blue-500/30 ring-2 ring-blue-400/50' 
                        : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                    } active:scale-90`}
                    title={isMeasuringActive ? "Finalizar / Cancelar Medição (M)" : "Medir Distâncias e Áreas (M)"}
                    aria-label="Medir Distâncias e Áreas"
                  >
                    <Ruler className={`w-4 h-4 ${isMeasuringActive ? 'text-white' : 'text-[#FF9500]'}`} />
                  </button>
                )}

                {/* Bússola / Resetar Visão Geral */}
                <button 
                  type="button"
                  onClick={() => {
                    if (mapRef.current) {
                      mapRef.current.setView([-7.0, -42.8], 7, { animate: true });
                    }
                  }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-2xl bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                  title="Restaurar Visão Geral / Norte (Apple Maps)"
                  aria-label="Bússola / Resetar Visão"
                >
                  <Compass className="w-4 h-4 text-[#FF3B30]" />
                </button>

                {/* Minha Localização GPS */}
                <button 
                  type="button"
                  onClick={toggleUserLocation} 
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl border border-black/5 dark:border-white/10 backdrop-blur-2xl transition-all cursor-pointer ${
                    showUserLocation 
                      ? 'bg-[#007AFF] text-white shadow-blue-500/30' 
                      : 'bg-white/85 dark:bg-[#1c1c1e]/85 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                  } active:scale-90`}
                  title={showUserLocation ? "Desativar Localização GPS" : "Minha Localização GPS (Apple Maps)"}
                  aria-label="Minha Localização GPS"
                >
                  <Navigation className={`w-4 h-4 ${showUserLocation ? 'text-white animate-pulse' : 'text-[#007AFF]'}`} />
                </button>
              </div>

              {/* 4. Painel de Camadas Vetoriais (Apple Glass Sheet) */}
              {allowLayerPanel && (layersPanelOpen || isPrintMode) && (
                <div 
                  id="layers-panel" 
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden flex flex-col ${isPrintMode ? 'w-full max-h-none shadow-none border-none bg-transparent' : 'mt-1 w-[270px] sm:w-[310px] max-h-[420px]'}`}
                >
                  {/* Cabeçalho do Painel com Salvar Estilo, Carregar e Ações */}
                  <div className="p-3 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] flex flex-col gap-2 shrink-0">
                    <div className="flex gap-1.5">
                      <button 
                        onClick={openSaveStyleModal}
                        type="button"
                        className="flex-grow px-2.5 py-1.5 bg-[#007AFF] hover:bg-[#0066d6] active:scale-95 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        title="Salvar configurações atuais em um estilo personalizado (até 4)"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Salvar Estilo
                      </button>
                      <button 
                        onClick={() => {
                          setShowLoadDropdown(!showLoadDropdown);
                          setShowSaveModal(false);
                        }}
                        type="button"
                        className={`px-2.5 py-1.5 border rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                          showLoadDropdown 
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-[#007AFF] dark:text-[#0a84ff] border-blue-200 dark:border-blue-800' 
                            : 'bg-white dark:bg-[#2c2c2e] border-black/5 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10'
                        }`}
                        title="Lista de estilos salvos"
                      >
                        <BookmarkCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                        Carregar
                          {savedStyles.length > 0 && (
                            <span className="ml-0.5 bg-blue-100 dark:bg-blue-900/60 text-[#007AFF] dark:text-[#0a84ff] text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                              {savedStyles.length}/4
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Lista de Estilos Salvos (Dropdown Expandível) */}
                      {showLoadDropdown && (
                        <div className="p-2 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1.5 my-0.5 animate-fadeIn">
                          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
                            <span className="flex items-center gap-1">
                              <BookmarkCheck className="w-3.5 h-3.5 text-[#007AFF]" />
                              Estilos Salvos ({savedStyles.length}/4)
                            </span>
                            <button 
                              type="button"
                              onClick={() => setShowLoadDropdown(false)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {savedStyles.length === 0 ? (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic py-1">
                              Nenhum estilo salvo. Clique em "Salvar Estilo" para criar até 4 salvamentos.
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-0.5">
                              {savedStyles.map((preset, idx) => (
                                <div 
                                  key={preset.id}
                                  className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all gap-1 text-left"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1 rounded">
                                        #{idx + 1}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={preset.name}>
                                        {preset.name}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                                      {preset.savedAt || 'Recente'} • {preset.activeLayers?.length || 0} camada(s)
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => applySavedStyle(preset)}
                                      className="px-2 py-0.5 bg-[#007AFF] hover:bg-[#0066d6] text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                                      title={`Aplicar ${preset.name}`}
                                    >
                                      Aplicar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteSavedStyle(preset.id, preset.name)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer transition-colors"
                                      title={`Excluir ${preset.name}`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-1">
                        <button 
                          onClick={() => toggleAllDetails(true)} 
                          type="button"
                          className="flex-1 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                        >
                          Expandir
                        </button>
                        <button 
                          onClick={() => toggleAllDetails(false)} 
                          type="button"
                          className="flex-1 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-[10px] font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                        >
                          Recolher
                        </button>
                        <button 
                          onClick={resetToDefaultStyle} 
                          type="button"
                          className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 text-slate-500 rounded text-[10px] font-semibold cursor-pointer flex items-center justify-center gap-1 transition-colors"
                          title="Restaurar configurações padrão de fábrica (limpa cores, opacidades e ativações de camadas)"
                        >
                          <RotateCcw className="w-3 h-3 text-red-600" />
                          <span>Padrão de Fábrica</span>
                        </button>
                      </div>
                    </div>

                    {/* Lista de Camadas com Opacidade, Zoom e Reordenação */}
                    <div id="layers-list" className={`p-2.5 space-y-3 overflow-y-auto custom-scrollbar flex-grow ${isPrintMode ? 'max-h-96' : ''}`}>
                      {(() => {
                        const effectiveDataSources = allowedLayerNames 
                          ? dataSources.filter(s => allowedLayerNames.includes(s.name))
                          : dataSources;
                        const activeSources = activeLayers
                          .map(name => effectiveDataSources.find(s => s.name === name))
                          .filter((s): s is DataSource => s !== undefined);
                        const inactiveSources = effectiveDataSources.filter(s => !activeLayers.includes(s.name));

                        return (
                          <>
                            {/* SEÇÃO 1: CAMADAS ATIVAS (REORDENÁVEIS POR ARRASTAR) */}
                            <div>
                              <div className="flex items-center justify-between px-1 mb-1.5">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                                  Camadas Ativas ({activeSources.length})
                                </span>
                                {activeSources.length > 1 && (
                                  <span className="text-[10px] text-slate-400 font-medium" title="A camada do topo fica visível por cima no mapa">
                                    Arraste para reordenar
                                  </span>
                                )}
                              </div>

                              {activeSources.length === 0 ? (
                                <div className="p-2.5 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                  Nenhuma camada ativa no momento. Marque uma camada abaixo para ativar.
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {activeSources.map((source) => {
                                    const isOpen = !!expandedDetails[source.name];
                                    const isDragging = draggedLayer === source.name;
                                    const isTarget = dragOverLayer === source.name;
                                    const isVisible = isLayerVisible(source.name);

                                    return (
                                      <div 
                                        key={source.name} 
                                        draggable={true}
                                        onDragStart={(e) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.closest('.no-drag')) { e.preventDefault(); return; } 
                                          e.dataTransfer.setData('text/plain', source.name);
                                          e.dataTransfer.effectAllowed = 'move';
                                          setDraggedLayer(source.name);
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.dataTransfer.dropEffect = 'move';
                                          if (dragOverLayer !== source.name) {
                                            setDragOverLayer(source.name);
                                          }
                                        }}
                                        onDragLeave={() => {
                                          if (dragOverLayer === source.name) {
                                            setDragOverLayer(null);
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          const dragged = e.dataTransfer.getData('text/plain') || draggedLayer;
                                          if (dragged && dragged !== source.name) {
                                            const fromIndex = activeLayers.indexOf(dragged);
                                            const toIndex = activeLayers.indexOf(source.name);
                                            if (fromIndex !== -1 && toIndex !== -1) {
                                              const updated = [...activeLayers];
                                              const [moved] = updated.splice(fromIndex, 1);
                                              updated.splice(toIndex, 0, moved);
                                              setActiveLayers(updated);
                                            }
                                          }
                                          setDraggedLayer(null);
                                          setDragOverLayer(null);
                                        }}
                                        onDragEnd={() => {
                                          setDraggedLayer(null);
                                          setDragOverLayer(null);
                                        }}
                                        className={`border rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-xs transition-all duration-150 ${
                                          isDragging 
                                            ? 'opacity-40 border-dashed border-red-500 bg-red-50/20 dark:bg-red-950/20' 
                                            : isTarget 
                                            ? 'border-red-600 ring-2 ring-red-500/60 bg-red-50/50 dark:bg-red-950/40' 
                                            : isVisible
                                            ? 'border-red-200 dark:border-red-900/60'
                                            : 'border-slate-200 dark:border-slate-800 opacity-70 bg-slate-50/60 dark:bg-slate-900/60'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between p-2 gap-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {activeSources.length > 1 && (
                                              <div 
                                                className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded shrink-0 transition-colors" 
                                                title="Pressione e arraste para reordenar esta camada no mapa"
                                              >
                                                <GripVertical className="w-3.5 h-3.5" />
                                              </div>
                                            )}
                                            <input 
                                              type="checkbox" 
                                              id={`layer-${source.name}`} 
                                              checked={isVisible}
                                              onChange={() => toggleLayerVisibility(source.name)}
                                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500 cursor-pointer shrink-0" 
                                            />
                                            <label 
                                              htmlFor={`layer-${source.name}`} 
                                              className={`text-xs cursor-pointer truncate ${
                                                isVisible 
                                                  ? 'font-bold text-red-950 dark:text-red-200' 
                                                  : 'font-semibold text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-700'
                                              }`}
                                              title={source.name}
                                            >
                                              {source.name}
                                            </label>
                                            {!isVisible && (
                                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded shrink-0">
                                                oculta
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                              type="button"
                                              onClick={() => zoomToLayer(source)}
                                              className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 rounded cursor-pointer" 
                                              title={`Centralizar em ${source.name}`}
                                            >
                                              <ZoomIn className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => setExpandedDetails(prev => ({ ...prev, [source.name]: !isOpen }))}
                                              className="text-slate-400 hover:text-slate-700 dark:text-slate-300 font-mono text-xs font-bold px-1 py-0.5 rounded cursor-pointer"
                                            >
                                              {isOpen ? '−' : '+'}
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => removeLayerFromActive(source.name)}
                                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer transition-colors" 
                                              title={`Remover ${source.name} das Camadas Ativas`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {isOpen && (
                                          <div 
                                            draggable={false}
                                            onDragStart={(e) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.closest('.no-drag')) { e.preventDefault(); return; }  e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="no-drag px-3 pb-2.5 pt-1 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2"
                                          >
                                            <div className="flex flex-col gap-1">
                                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                                <span>Opacidade</span>
                                                <span>{Math.round(layerOpacities[source.name] * 100)}%</span>
                                              </div>
                                              <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05" 
                                                value={layerOpacities[source.name]} 
                                                draggable={false}
                                                onDragStart={(e) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.closest('.no-drag')) { e.preventDefault(); return; }  e.preventDefault(); e.stopPropagation(); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleOpacityChange(source.name, parseFloat(e.target.value))}
                                                className="w-full accent-red-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Cor (Preench.)</span>
                                              <input 
                                                type="color" 
                                                value={layerColorsState[source.name] || getLayerColor(source.name)} 
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleColorChange(source.name, e.target.value)}
                                                className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0" 
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Cor (Borda)</span>
                                              <input 
                                                type="color" 
                                                value={layerStrokeColorsState[source.name] || layerColorsState[source.name] || getLayerColor(source.name)} 
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleStrokeColorChange(source.name, e.target.value)}
                                                className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0" 
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* SEÇÃO 2: CAMADAS INATIVAS */}
                            {inactiveSources.length > 0 && (
                              <div className="pt-1">
                                <div className="px-1 mb-1.5">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Camadas Inativas ({inactiveSources.length})
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  {inactiveSources.map(source => {
                                    const isOpen = !!expandedDetails[source.name];

                                    return (
                                      <div key={source.name} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                                        <div className="flex items-center justify-between p-2 gap-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <input 
                                              type="checkbox" 
                                              id={`layer-${source.name}`} 
                                              checked={false}
                                              onChange={() => activateLayer(source.name)}
                                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500 cursor-pointer shrink-0" 
                                            />
                                            <label 
                                              htmlFor={`layer-${source.name}`} 
                                              className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer truncate"
                                              title={source.name}
                                            >
                                              {source.name}
                                            </label>
                                          </div>
                                          
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button 
                                              type="button"
                                              onClick={() => zoomToLayer(source)}
                                              className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/40 rounded cursor-pointer" 
                                              title={`Centralizar em ${source.name}`}
                                            >
                                              <ZoomIn className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => setExpandedDetails(prev => ({ ...prev, [source.name]: !isOpen }))}
                                              className="text-slate-400 hover:text-slate-700 dark:text-slate-300 font-mono text-xs font-bold px-1 py-0.5 rounded cursor-pointer"
                                            >
                                              {isOpen ? '−' : '+'}
                                            </button>
                                          </div>
                                        </div>

                                        {isOpen && (
                                          <div 
                                            draggable={false}
                                            onDragStart={(e) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.closest('.no-drag')) { e.preventDefault(); return; }  e.preventDefault(); e.stopPropagation(); }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className="no-drag px-3 pb-2.5 pt-1 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2"
                                          >
                                            <div className="flex flex-col gap-1">
                                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                                <span>Opacidade</span>
                                                <span>{Math.round(layerOpacities[source.name] * 100)}%</span>
                                              </div>
                                              <input 
                                                type="range" 
                                                min="0" 
                                                max="1" 
                                                step="0.05" 
                                                value={layerOpacities[source.name]} 
                                                draggable={false}
                                                onDragStart={(e) => { const target = e.target as HTMLElement; if (target.tagName === 'INPUT' || target.closest('.no-drag')) { e.preventDefault(); return; }  e.preventDefault(); e.stopPropagation(); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleOpacityChange(source.name, parseFloat(e.target.value))}
                                                className="w-full accent-red-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Cor (Preench.)</span>
                                              <input 
                                                type="color" 
                                                value={layerColorsState[source.name] || getLayerColor(source.name)} 
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleColorChange(source.name, e.target.value)}
                                                className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0" 
                                              />
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Cor (Borda)</span>
                                              <input 
                                                type="color" 
                                                value={layerStrokeColorsState[source.name] || layerColorsState[source.name] || getLayerColor(source.name)} 
                                                draggable={false}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onChange={(e) => handleStrokeColorChange(source.name, e.target.value)}
                                                className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0" 
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
            </div>
          );
          
          if (isPrintMode && portalTarget) {
            return createPortal(controlsContent, portalTarget);
          }
          return controlsContent;
        })()}



        {/* Modal de Salvar Estilo Personalizado */}
        {showSaveModal && (
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-sm w-full p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-red-600" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Salvar Estilo Atual
                  </h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowSaveModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmSaveStyle} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Estilo:
                  </label>
                  <input 
                    type="text"
                    value={styleNameInput}
                    onChange={(e) => setStyleNameInput(e.target.value)}
                    placeholder="Ex: Visão Noturna, Análise Terrenos..."
                    autoFocus
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Salva a ordem das camadas, visibilidade, opacidades, cores e o mapa base.
                  </p>
                </div>

                {savedStyles.length >= 4 && !overwriteStyleId && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Limite de 4 estilos atingido!</span>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      Selecione um estilo existente para substituir:
                    </p>
                    <div className="space-y-1">
                      {savedStyles.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setOverwriteStyleId(preset.id);
                            setStyleNameInput(preset.name);
                          }}
                          className={`w-full text-left p-1.5 rounded text-xs flex items-center justify-between transition-colors border cursor-pointer ${
                            overwriteStyleId === preset.id
                              ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-700 dark:text-red-300 font-bold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{preset.name}</span>
                          <span className="text-[9px] text-slate-400">Substituir</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {overwriteStyleId && (
                  <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between text-xs text-red-700 dark:text-red-300">
                    <span>Substituindo estilo selecionado</span>
                    <button 
                      type="button" 
                      onClick={() => setOverwriteStyleId(null)}
                      className="text-[10px] underline font-bold cursor-pointer"
                    >
                      Cancelar substituição
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowSaveModal(false);
                      setOverwriteStyleId(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
