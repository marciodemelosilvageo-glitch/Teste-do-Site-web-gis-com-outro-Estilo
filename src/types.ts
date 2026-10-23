import L from 'leaflet';

export interface DataSource {
  name: string;
  url: string;
  popupProperty: string;
  style: (feature: any) => L.PathOptions;
}

export interface SelectedFeature {
  id: string; // Leaflet layer _leaflet_id
  name: string; // Formatted display name
  sourceName: string; // Dataset source name
  layer: L.Layer; // Leaflet layer reference
  properties: Record<string, any>;
}

export interface SearchResultItem {
  polygonLayer: any;
  value: any;
  key: string;
  distance: number;
}

export interface GroupedSearchResults {
  [layerName: string]: SearchResultItem[];
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  lat: number;
  lng: number;
}

export interface SavedStylePreset {
  id: string;
  name: string;
  activeLayers: string[];
  visibleLayers: Record<string, boolean>;
  layerOpacities: Record<string, number>;
  layerColorsState: Record<string, string>;
  layerStrokeColorsState: Record<string, string>;
  localidadesFontFamily?: string;
  basemap: string;
  savedAt: string;
}

