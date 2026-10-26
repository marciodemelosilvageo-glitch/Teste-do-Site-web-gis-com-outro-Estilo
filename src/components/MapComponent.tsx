import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet-measure/dist/leaflet-measure.css';
import { Layers, ZoomIn, Copy, Compass, ExternalLink, MousePointerClick, Search, GripVertical, Save, BookmarkCheck, Trash2, RotateCcw, Eye, EyeOff, X, Check, AlertCircle, Ruler, LocateFixed, Navigation, ChevronDown, ChevronUp, MapPin, Star, Plus, Minus, Map as MapIcon } from 'lucide-react';
import { DataSource, SelectedFeature, ContextMenuState, SavedStylePreset } from '../types';
import { dataSources, situationMap, typeMap, propertyNames, getLayerColor, DEFAULT_ACTIVE_LAYERS } from '../data';
import { getIdentifier, getTranslatedValue, getFeatureCenter, patchMeasureControl, haversineDistanceMeters, formatDistance, toTitleCase } from '../utils';

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

const createGoogleMapsLabelIcon = (name: string, zoom: number, customColor?: string) => {
  const dotColor = customColor || '#dc2626';
  const fontSize = zoom <= 9 ? '10px' : zoom <= 11 ? '11px' : '12px';

  const formattedName = toTitleCase(name);
  const safeName = String(formattedName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // SVG de alfinete (map pin) customizado com classes CSS para animação e hover
  const pinSvg = `
    <svg class="localidade-pin-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${dotColor}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"></circle>
    </svg>
  `;

  return L.divIcon({
    className: 'google-maps-localidade-label',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `
      <div class="localidade-marker-container">
        ${pinSvg}
        <span class="localidade-marker-text" style="font-size: ${fontSize};">
          ${safeName}
        </span>
      </div>
    `
  });
};

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
      const isSelected = selectedFeatures.some(f => f.layer === marker || f.id === String((marker as any)._leaflet_id));
      const passesZoom = currentZoom >= marker.minZoom;

      if (passesZoom || isSelected) {
        // Calcular posição do rótulo na tela em pixels para detecção precisa de colisão
        const pt = map.latLngToContainerPoint(latLng);
        const nameLen = (marker.featureName || '').length;
        const textWidth = nameLen * charWidth + 24;

        // Bounding box rigoroso cobrindo o pin (-14px a +14px horizontal, -24px a 0px vertical) + o texto (+14px a +14px+textWidth horizontal, -18px a +6px vertical)
        const box: LabelBox = {
          minX: pt.x - 14,
          minY: pt.y - 24,
          maxX: pt.x + 14 + textWidth,
          maxY: pt.y + 8,
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
          marker.setIcon(createGoogleMapsLabelIcon(marker.featureName, currentZoom, customColor));
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
  searchCoordinates: Array<{ lat: number; lng: number; label?: string; details?: string[]; isCoordSearch?: boolean }> | null;
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
}

export const MapComponent: React.FC<MapComponentProps> = ({
  isPrintMode,
  isMultiSelectMode,
  selectedFeatures,
  onSelectionChange,
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
  isBottomBarMaximized = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lastMeasureModelRef = useRef<any>(null);
  const onSearchPolygonAddressesRef = useRef(onSearchPolygonAddresses);

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
    showToast('🗑️ Medição removida do mapa.');
  }, [activeMeasureInfo, showToast]);

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
  const openPolygonCallout = useCallback((layer: L.Layer, htmlContent: string, clickLatLng?: L.LatLng, fitPolygon: boolean = true) => {
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

  // Elemento DOM da ferramenta de medição do Leaflet para portal do histórico
  const [measureContainerEl, setMeasureContainerEl] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    if (measureHistory && measureHistory.length > 0) {
      const updateEl = () => {
        const el = mapContainerRef.current?.querySelector('.leaflet-control-measure') as HTMLElement | null;
        if (el) {
          setMeasureContainerEl(el);
        }
      };
      updateEl();
      const timer = setTimeout(updateEl, 80);
      return () => clearTimeout(timer);
    } else {
      setMeasureContainerEl(null);
    }
  }, [measureHistory]);

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
      if (onSearchCoordinateRef.current) {
        onSearchCoordinateRef.current(`${latStr}, ${lngStr}`);
      }
    };
    (window as any).copyCtxCoord = (type: 'all' | 'lat' | 'lng', latStr: string, lngStr: string) => {
      if (type === 'all') {
        navigator.clipboard.writeText(`${latStr}, ${lngStr}`);
        if (showToastRef.current) showToastRef.current(`Coordenadas copiadas: ${latStr}, ${lngStr}`);
      } else if (type === 'lat') {
        navigator.clipboard.writeText(latStr);
        if (showToastRef.current) showToastRef.current(`Latitude copiada: ${latStr}`);
      } else {
        navigator.clipboard.writeText(lngStr);
        if (showToastRef.current) showToastRef.current(`Longitude copiada: ${lngStr}`);
      }
    };
  }, []);

  // Definição dos Basemaps
  const tileLayersRef = useRef<Record<string, L.TileLayer>>({});
  const searchMarkersRef = useRef<L.Marker[]>([]);

  // Estilo de seleção destacado estilo Apple Maps (Apple Blue brilhante com contorno animado)
  const selectedStyle: L.PathOptions = { 
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

    // Camada de Localidades (Pontos) possui ícone próprio e NÃO recebe animação de contorno tracejado
    if (layer.customSourceName === "Localidades (Piauí)" || layer._icon || (typeof L !== 'undefined' && layer instanceof L.Marker)) {
      return;
    }

    const updateSingle = (l: any) => {
      if (l.customSourceName === "Localidades (Piauí)" || l._icon || (typeof L !== 'undefined' && l instanceof L.Marker)) {
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
        }
        const resetStyle: L.PathOptions = {
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
  }, [selectedFeatures]);

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
            position: 'topleft',
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

    if (onMeasureChange) {
      map.on('measurechange', (e: any) => {
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
          if (typeof layer.openPopup === 'function') {
            layer.openPopup(ev.latlng || (layer.getBounds ? layer.getBounds().getCenter() : undefined));
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

    // Injeta botão de busca CNEFE no popup de resultado da medição de polígono
    map.on('popupopen', (e: any) => {
      const popup = e.popup;
      if (!popup) return;
      const container = popup.getElement ? popup.getElement() : null;
      if (!container) return;

      const isMeasurePopup = container.classList?.contains('leaflet-measure-resultpopup') ||
                             container.querySelector('.leaflet-measure-resultpopup') ||
                             container.querySelector('.js-deletemarkup');

      if (isMeasurePopup) {
        const model = lastMeasureModelRef.current;
        let points = model?.points;
        if (!points && (popup as any)._source && typeof (popup as any)._source.getLatLngs === 'function') {
          const latlngs = (popup as any)._source.getLatLngs();
          points = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
        }
        
        // Listener para o botão nativo de exclusão do leaflet-measure
        const deleteMarkupBtn = container.querySelector('.js-deletemarkup');
        if (deleteMarkupBtn && !(deleteMarkupBtn as any)._hasCleanupListener) {
          (deleteMarkupBtn as any)._hasCleanupListener = true;
          deleteMarkupBtn.addEventListener('click', () => {
            setActiveMeasureInfo(null);
            lastMeasureModelRef.current = null;
          });
        }

        // Verifica se a medição contém 3 ou mais pontos (área/polígono)
        if (points && points.length >= 3 && !container.querySelector('.js-cnefe-measure-btn')) {
          const tasksUl = container.querySelector('.tasks') || container.querySelector('.leaflet-popup-content') || container;
          if (tasksUl) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'webgis-popup-cnefe-btn js-cnefe-measure-btn';
            btn.style.width = '100%';
            btn.style.marginTop = '8px';
            btn.style.cursor = 'pointer';
            btn.style.padding = '8px 12px';
            btn.style.fontSize = '11.5px';
            btn.style.fontWeight = '700';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.gap = '6px';
            btn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
            btn.style.color = '#ffffff';
            btn.style.border = 'none';
            btn.style.borderRadius = '10px';
            btn.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.35)';
            btn.style.transition = 'all 0.2s ease';
            btn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span>Buscar Endereços CNEFE nesta Área</span>
            `;

            btn.onclick = (evt) => {
              evt.preventDefault();
              evt.stopPropagation();

              const rawCoords = points.map((p: any) => [
                Number(p.lng !== undefined ? p.lng : (p[1] !== undefined ? p[1] : p[0])),
                Number(p.lat !== undefined ? p.lat : (p[0] !== undefined ? p[0] : p[1]))
              ]);

              if (rawCoords.length >= 3) {
                if (rawCoords[0][0] !== rawCoords[rawCoords.length - 1][0] || rawCoords[0][1] !== rawCoords[rawCoords.length - 1][1]) {
                  rawCoords.push([rawCoords[0][0], rawCoords[0][1]]);
                }

                const polygonGeoJson = {
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [rawCoords]
                  },
                  properties: {
                    Nome: `Área Medida (${model?.areaDisplay || 'Polígono'})`,
                    sourceName: 'Medição'
                  }
                };

                if (onSearchPolygonAddressesRef.current) {
                  onSearchPolygonAddressesRef.current({
                    feature: polygonGeoJson,
                    title: `Área Medida (${model?.areaDisplay || 'Polígono'})`,
                    sourceName: 'Medição',
                    layer: null
                  });
                }
              }
            };

            if (tasksUl.classList.contains('tasks') || tasksUl.tagName === 'UL') {
              const li = document.createElement('li');
              li.style.listStyle = 'none';
              li.style.marginTop = '6px';
              li.appendChild(btn);
              tasksUl.appendChild(li);
            } else {
              tasksUl.appendChild(btn);
            }
            if (typeof popup.update === 'function') {
              popup.update();
            }
          }
        }
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
      const measuringPrompt = document.querySelector('.js-measuringprompt') as HTMLElement;
      if (measuringPrompt && measuringPrompt.style.display !== 'none') {
        return;
      }

      // Clique no mapa sem feição limpa a seleção e o balão callout de polígonos
      if (e.originalEvent && (e.originalEvent as any)._simulated) return;
      clearPolygonCallout();
      onSelectionChange([]);
    });

    map.on('measurestart', () => {
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

    // Registrar o evento de Context Menu (Botão Direito) no mapa
    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const latFormatted = lat.toFixed(6);
      const lngFormatted = lng.toFixed(6);

      const popupContent = `
        <div class="webgis-popup-container" style="min-width: 215px; max-width: 255px;">
          <!-- Badge Cabeçalho -->
          <div class="webgis-popup-badge-row" style="justify-content: center;">
            <div class="webgis-popup-badge" style="background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.25); color: #2563eb;">
              <span class="webgis-popup-dot" style="background-color: #2563eb;"></span>
              <span>Ponto Geográfico</span>
            </div>
          </div>

          <!-- Seção de Coordenadas com Clique Individual para Copiar -->
          <div class="webgis-popup-attributes-grid" style="padding: 6px;">
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: center; letter-spacing: 0.5px;">
              Coordenadas (Clique p/ Copiar)
            </div>

            <div class="webgis-coord-grid">
              <!-- Botão Latitude -->
              <button
                type="button"
                class="webgis-coord-btn"
                onclick="event.preventDefault(); event.stopPropagation(); window.copyCtxCoord('lat', '${latFormatted}', '${lngFormatted}'); const el=this.querySelector('.webgis-coord-btn-val'); if(el){ el.innerText='Copiado!'; el.style.color='#059669'; setTimeout(() => { el.innerText='${latFormatted}'; el.style.color=''; }, 1800); }"
                title="Clique para copiar somente a Latitude (${latFormatted})"
              >
                <span class="webgis-coord-btn-label">Latitude</span>
                <span class="webgis-coord-btn-val">${latFormatted}</span>
              </button>

              <!-- Botão Longitude -->
              <button
                type="button"
                class="webgis-coord-btn"
                onclick="event.preventDefault(); event.stopPropagation(); window.copyCtxCoord('lng', '${latFormatted}', '${lngFormatted}'); const el=this.querySelector('.webgis-coord-btn-val'); if(el){ el.innerText='Copiado!'; el.style.color='#059669'; setTimeout(() => { el.innerText='${lngFormatted}'; el.style.color=''; }, 1800); }"
                title="Clique para copiar somente a Longitude (${lngFormatted})"
              >
                <span class="webgis-coord-btn-label">Longitude</span>
                <span class="webgis-coord-btn-val">${lngFormatted}</span>
              </button>
            </div>

            <!-- Atalho Copiar Ambas -->
            <div style="margin-top: 4px; text-align: center;">
              <button
                type="button"
                onclick="event.preventDefault(); event.stopPropagation(); window.copyCtxCoord('all', '${latFormatted}', '${lngFormatted}'); const el=this; el.innerText='✓ Ambas Copiadas!'; el.style.color='#059669'; setTimeout(() => { el.innerText='Copiar Ambas (${latFormatted}, ${lngFormatted})'; el.style.color='#64748b'; }, 1800);"
                style="background: transparent; border: none; font-size: 9.5px; font-weight: 600; color: #64748b; cursor: pointer; text-decoration: underline; padding: 1px 4px;"
                title="Copiar Latitude e Longitude juntas"
              >
                Copiar Ambas (${latFormatted}, ${lngFormatted})
              </button>
            </div>
          </div>

          <!-- Pesquisar Feições Aqui -->
          <button
            type="button"
            class="webgis-popup-cnefe-btn"
            onclick="event.preventDefault(); event.stopPropagation(); if(window.identifyFeaturesFromCtx) window.identifyFeaturesFromCtx('${latFormatted}', '${lngFormatted}');"
            style="margin-top: 0; padding: 7px 10px; font-size: 11px;"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Pesquisar Feições Aqui</span>
          </button>

          <!-- Abrir no Street View -->
          <a
            href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latFormatted},${lngFormatted}"
            target="_blank"
            rel="noreferrer"
            class="webgis-streetview-btn"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
            <span>Abrir no Street View</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: auto; opacity: 0.7;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      `;

      L.popup({
        className: 'polygon-callout-balloon',
        closeButton: true
      })
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
    });

    // Função de limpeza do mapa ao desmontar
    return () => {
      resizeObserver.disconnect();
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

  // Monitorar busca por coordenada para exibir marcador temporário destacado
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remover marcadores antigos se existirem
    searchMarkersRef.current.forEach(marker => {
      if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    searchMarkersRef.current = [];

    if (searchCoordinates && searchCoordinates.length > 0) {
      // Ícone com pin pulsante usando Tailwind
      const searchIcon = L.divIcon({
        className: 'custom-search-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-red-500/30 rounded-full animate-ping"></div>
            <div class="w-5 h-5 bg-red-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <div class="w-2 h-2 bg-white dark:bg-slate-900 rounded-full"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      searchCoordinates.forEach((coord) => {
        const { lat, lng, details, isCoordSearch } = coord;
        
        // Adicionar marcador
        const marker = L.marker([lat, lng], { icon: searchIcon }).addTo(map);
        
        let detailsHtml = '';
        if (details && details.length > 0) {
          detailsHtml = `
            <div class="webgis-popup-attributes-grid" style="margin-top: 4px; padding: 6px 8px;">
              ${details.map(d => {
                const parts = d.split(':');
                const label = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                const isLocalidade = label.toLowerCase().includes('localidade');
                
                // Mostrar nota de 800m APENAS se for busca por coordenada / Identificar Feições
                const show800mNote = !!isCoordSearch && isLocalidade;
                
                const noteHtml = show800mNote ? `
                  <div style="font-size: 9px; font-weight: 600; color: #0284c7; background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.2); padding: 4px 6px; border-radius: 6px; margin: 3px 0; display: flex; align-items: center; gap: 4px; line-height: 1.3;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span>Localidade cadastrada a até ~800m do ponto pesquisado</span>
                  </div>
                ` : '';

                const safeVal = String(value).replace(/'/g, "\\'");
                return `${noteHtml}
                  <div class="webgis-popup-attribute-item">
                    <span class="webgis-popup-attr-label">${label}</span>
                    <div class="webgis-popup-attr-val-box">
                      <span class="webgis-popup-attr-val">${value}</span>
                      <button type="button" class="webgis-popup-copy-btn" onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${safeVal}'); const old=this.innerHTML; this.innerHTML='<svg width=\\'11\\' height=\\'11\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'3\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>'; setTimeout(() => this.innerHTML=old, 2000)" title="Copiar ${label}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        }
        
        const latFormatted = lat.toFixed(6);
        const lngFormatted = lng.toFixed(6);

        marker.bindPopup(`
          <div class="webgis-popup-container" style="min-width: 215px; max-width: 265px;">
            <!-- Badge Cabeçalho -->
            <div class="webgis-popup-badge-row" style="justify-content: center;">
              <div class="webgis-popup-badge" style="background: rgba(225, 29, 72, 0.1); border-color: rgba(225, 29, 72, 0.25); color: #e11d48;">
                <span class="webgis-popup-dot" style="background-color: #e11d48;"></span>
                <span>Coordenada Localizada</span>
              </div>
            </div>

            <!-- Seção de Coordenadas -->
            <div class="webgis-popup-attributes-grid" style="padding: 6px;">
              <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: center; letter-spacing: 0.5px;">
                Coordenadas (Clique p/ Copiar)
              </div>

              <div class="webgis-coord-grid">
                <!-- Botão de Latitude -->
                <button 
                  type="button" 
                  class="webgis-coord-btn"
                  onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${latFormatted}'); const el=this.querySelector('.webgis-coord-btn-val'); const old=el.innerText; el.innerText='Copiado!'; el.style.color='#059669'; setTimeout(() => { el.innerText='${latFormatted}'; el.style.color=''; }, 1800);"
                  title="Clique para copiar somente a Latitude (${latFormatted})"
                >
                  <span class="webgis-coord-btn-label">Latitude</span>
                  <span class="webgis-coord-btn-val">${latFormatted}</span>
                </button>

                <!-- Botão de Longitude -->
                <button 
                  type="button" 
                  class="webgis-coord-btn"
                  onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${lngFormatted}'); const el=this.querySelector('.webgis-coord-btn-val'); const old=el.innerText; el.innerText='Copiado!'; el.style.color='#059669'; setTimeout(() => { el.innerText='${lngFormatted}'; el.style.color=''; }, 1800);"
                  title="Clique para copiar somente a Longitude (${lngFormatted})"
                >
                  <span class="webgis-coord-btn-label">Longitude</span>
                  <span class="webgis-coord-btn-val">${lngFormatted}</span>
                </button>
              </div>

              <!-- Atalho para copiar ambas juntas -->
              <div style="margin-top: 4px; text-align: center;">
                <button
                  type="button"
                  onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${latFormatted}, ${lngFormatted}'); const el=this; const old=el.innerText; el.innerText='✓ Ambas Copiadas!'; el.style.color='#059669'; setTimeout(() => { el.innerText='Copiar Ambas (${latFormatted}, ${lngFormatted})'; el.style.color='#64748b'; }, 1800);"
                  style="background: transparent; border: none; font-size: 9.5px; font-weight: 600; color: #64748b; cursor: pointer; text-decoration: underline; padding: 1px 4px;"
                  title="Copiar Latitude e Longitude juntos"
                >
                  Copiar Ambas (${latFormatted}, ${lngFormatted})
                </button>
              </div>
            </div>

            ${detailsHtml}
          </div>
        `, {
          className: 'polygon-callout-balloon'
        });
        
        searchMarkersRef.current.push(marker);
      });

      if (searchCoordinates.length === 1) {
        searchMarkersRef.current[0].openPopup();
      }
    }
  }, [searchCoordinates]);

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
              const customColor = layerColorsRef.current[source.name] || '#dc2626';
              updateLocalidadesViewport(layer, map, selectedFeatures, customColor);
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
          const customColor = layerColorsRef.current["Localidades (Piauí)"] || '#dc2626';
          updateLocalidadesViewport(locLayer, map, selectedFeatures, customColor);
        }
        updateLegendViewport();
      }, 100);
    };

    map.on('zoomend', syncMapLayers);
    map.on('moveend', handleDebouncedMapMove);
    return () => {
      if (moveTimer) clearTimeout(moveTimer);
      map.off('zoomend', syncMapLayers);
      map.off('moveend', handleDebouncedMapMove);
    };
  }, [activeLayers, visibleLayers, allowedLayerNames, updateLegendViewport]);

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
          openPolygonCallout(layer, (layer as any)._popupContentHtml, undefined, true);
        }

        onSelectionChange([{
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

          const renderCopyableField = (label: string, val: string) => {
            const safeVal = String(val).replace(/'/g, "\\'");
            return `
              <div class="webgis-popup-attribute-item">
                <span class="webgis-popup-attr-label">${label}</span>
                <div class="webgis-popup-attr-val-box">
                  <span class="webgis-popup-attr-val">${val}</span>
                  <button type="button" class="webgis-popup-copy-btn" onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${safeVal}'); const old=this.innerHTML; this.innerHTML='<svg width=\\'11\\' height=\\'11\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'3\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>'; setTimeout(() => this.innerHTML=old, 2000)" title="Copiar ${label}">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
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
              const coordStr = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
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
            searchPolygonBtnHtml = `
              <button 
                type="button"
                class="webgis-popup-cnefe-btn"
                onclick="event.preventDefault(); event.stopPropagation(); if (window.searchAddressesInPolygonByLayerId) window.searchAddressesInPolygonByLayerId('${layerId}');"
                title="Consultar e listar todos os endereços do CNEFE/IBGE contidos neste polígono"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <span>Buscar Endereços CNEFE</span>
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
          const safeTitle = String(title).replace(/'/g, "\\'");
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
                  <div class="webgis-popup-title-val">${title}</div>
                  <button type="button" class="webgis-popup-copy-btn" onclick="event.preventDefault(); event.stopPropagation(); navigator.clipboard.writeText('${safeTitle}'); const old=this.innerHTML; this.innerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'3\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'><polyline points=\\'20 6 9 17 4 12\\'></polyline></svg>'; setTimeout(() => this.innerHTML=old, 2000)" title="Copiar ${fieldLabel}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              </div>

              ${extraInfoHtml}
              ${searchPolygonBtnHtml}
            </div>
          `;

          (layer as any)._popupContentHtml = popupContentHtml;

          // Se for camada de ponto (que não seja polígono), mantém o popup padrão anexado
          if (!isPolygon && !isAreaLayer) {
            layer.bindPopup(popupContentHtml);
          }

          // Clique na feição
          layer.on('click', (ev: L.LeafletMouseEvent) => {
            try {
              L.DomEvent.stopPropagation(ev);
              
              // Ignore click if the measuring tool is active
              const measuringPrompt = document.querySelector('.js-measuringprompt') as HTMLElement;
              if (measuringPrompt && measuringPrompt.style.display !== 'none') {
                return;
              }

              // Para feições poligonais, enquadra o polígono e abre o Balão Callout Lateral com linha conectora a partir da borda
              if (isPolygon || isAreaLayer) {
                openPolygonCallout(layer, popupContentHtml, ev.latlng, true);
              }

              const isCtrl = ev.originalEvent ? (ev.originalEvent.ctrlKey || ev.originalEvent.metaKey) : false;
              const multi = isCtrl || isMultiSelectModeRef.current;

              onSelectionChange((prevSelected) => {
                const alreadySelected = prevSelected.some(item => item.id === String(layer._leaflet_id));

                if (multi) {
                  if (alreadySelected) {
                    // Remove da seleção múltipla
                    applySelectedStyleToLayer(layer, false);
                    return prevSelected.filter(item => item.id !== String(layer._leaflet_id));
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
                  // Seleção simples: limpa outros estilos
                  prevSelected.forEach(item => {
                    applySelectedStyleToLayer(item.layer, false);
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

      // Se for a camada de Localidades (Pontos), usar Rótulos Estilo Google Mapas
      if (source.name === "Localidades (Piauí)") {
        const allMarkers: any[] = [];
        const minZoomMap = computeSpatialMinZooms(data.features || []);

        geojsonOptions.pointToLayer = (feature, latlng) => {
          const minZoom = minZoomMap.get(feature) ?? 12;
          const props = feature?.properties || {};
          const rawName = props.Localidade || props.NM_LOCALIDA || props.name || props.Nome || props.NM_MUN || props.NM_AGLOM || getIdentifier(props);
          const name = toTitleCase(String(getTranslatedValue('Localidade', rawName) || rawName || 'Localidade').trim());

          const customColor = layerColorsRef.current[source.name] || '#dc2626';
          const initialZoom = mapRef.current ? mapRef.current.getZoom() : 8;

          const icon = createGoogleMapsLabelIcon(name, initialZoom, customColor);
          const marker = L.marker(latlng, { icon, pane: 'markerPane' }) as any;
          marker.minZoom = minZoom;
          marker.featureName = name;
          marker.featureLatLng = latlng;
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
          const customColor = layerColorsRef.current[source.name] || '#dc2626';
          updateLocalidadesViewport(leafletLayer, mapRef.current, selectedFeatures, customColor);
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
        onSelectionChange((prevSel) => prevSel.filter(f => f.sourceName !== sourceName));
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
    onSelectionChange((prevSel) => prevSel.filter(f => f.sourceName !== sourceName));
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
    if (onSelectionChange) {
      onSelectionChange([]);
    }

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
          updateLocalidadesViewport(layer, mapRef.current, selectedFeatures, color);
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
    onSelectionChange([]);
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

        {/* BARRA FLUTUANTE DE MEDIÇÃO ATIVA NO MAPA */}
        {!isPrintMode && activeMeasureInfo && (
          <div 
            className="absolute top-16 left-3 sm:left-4 z-[999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl shadow-2xl border border-red-500/30 flex flex-wrap items-center gap-2 animate-fadeIn text-xs max-w-[95vw] sm:max-w-md"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold">
              <span className="p-1.5 rounded-xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 text-sm">📐</span>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-red-700 dark:text-red-400 leading-tight">
                  Polígono Medido: {activeMeasureInfo.areaDisplay}
                </span>
                {activeMeasureInfo.lengthDisplay && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
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
                  if (activeMeasureInfo.points && activeMeasureInfo.points.length >= 3) {
                    const rawCoords = activeMeasureInfo.points.map((p: any) => [
                      Number(p.lng !== undefined ? p.lng : (p[1] !== undefined ? p[1] : p[0])),
                      Number(p.lat !== undefined ? p.lat : (p[0] !== undefined ? p[0] : p[1]))
                    ]);
                    if (rawCoords[0][0] !== rawCoords[rawCoords.length - 1][0] || rawCoords[0][1] !== rawCoords[rawCoords.length - 1][1]) {
                      rawCoords.push([rawCoords[0][0], rawCoords[0][1]]);
                    }
                    const polygonGeoJson = {
                      type: 'Feature',
                      geometry: {
                        type: 'Polygon',
                        coordinates: [rawCoords]
                      },
                      properties: {
                        Nome: `Área Medida (${activeMeasureInfo.areaDisplay || 'Polígono'})`,
                        sourceName: 'Medição'
                      }
                    };
                    if (onSearchPolygonAddressesRef.current) {
                      onSearchPolygonAddressesRef.current({
                        feature: polygonGeoJson,
                        title: `Área Medida (${activeMeasureInfo.areaDisplay || 'Polígono'})`,
                        sourceName: 'Medição',
                        layer: null
                      });
                    }
                  }
                }}
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                title="Buscar Endereços neste polígono medido"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Buscar Endereços</span>
              </button>

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
                    if (typeof activeMeasureInfo.layer.openPopup === 'function') {
                      activeMeasureInfo.layer.openPopup();
                    }
                  }
                }}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold cursor-pointer transition-colors"
                title="Centralizar no mapa e abrir balão"
              >
                <LocateFixed className="w-4 h-4 text-blue-600" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearMeasurement();
                }}
                className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl font-bold cursor-pointer transition-colors"
                title="Apagar / Limpar Medição do Mapa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* LEGENDA CARTOGRÁFICA DO MAPA (ESTILO APPLE MAPS / iOS CAPSULE) */}
        {!isPrintMode ? (
          <div 
            className="absolute left-3 z-[990] flex flex-col items-start print:hidden select-none transition-all duration-300 ease-out"
            style={{
              bottom: !isBottomBarOpen 
                ? '16px' 
                : isBottomBarExpanded 
                  ? (isBottomBarMaximized ? 'calc(82vh + 14px)' : 'clamp(334px, calc(46vh + 14px), 454px)')
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
                <div className="w-2 h-2 rounded-full bg-[#007AFF] animate-pulse"></div>
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
                  ? (isBottomBarMaximized ? 'calc(82vh + 10px)' : 'clamp(330px, calc(46vh + 10px), 450px)')
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

        {/* HISTÓRICO DE PONTOS DA MEDIÇÃO (Portal diretamente na caixa da ferramenta de medição) */}
        {measureContainerEl && measureHistory && measureHistory.length > 0 && !isPrintMode && createPortal(
          <div className="p-2.5 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-900/90 text-left space-y-2 select-text my-1 rounded-b-xl">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Ruler size={13} className="text-red-600 dark:text-red-400 shrink-0" />
                <span>Histórico de Pontos</span>
              </h4>
              <span className="text-[9px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-1.5 py-0.2 rounded-full font-black">
                {measureHistory.length} {measureHistory.length === 1 ? 'ponto' : 'pontos'}
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
              {measureHistory.map((pt, i) => (
                <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg text-[10px] group hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors border border-slate-200/80 dark:border-slate-700/50">
                  <div className="text-slate-700 dark:text-slate-200 font-mono flex items-center gap-1 truncate">
                    <span className="text-red-700 dark:text-red-300 font-extrabold text-[9px] bg-red-100 dark:bg-red-900/60 px-1 py-0.2 rounded shrink-0">
                      #{i + 1}
                    </span>
                    <span className="truncate">
                      {pt.lat.toFixed(5)}&deg;, {pt.lng.toFixed(5)}&deg;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mapRef.current && (mapRef.current as any).measureControl) {
                        (mapRef.current as any).measureControl.removePoint(i);
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer shrink-0"
                    title="Excluir este ponto"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>,
          measureContainerEl
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
