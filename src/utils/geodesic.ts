// Normalizar texto para buscas sem acentos e em minúsculas
export const normalizeString = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

// Normalizar texto para buscas: minúsculas, sem acentos e qualquer caractere não alfanumérico vira espaço
export const normalizeSearchText = (s: string | null | undefined): string => {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Separa o nome base do logradouro e o número da porta para ordenação coerente
export const parseAddressForSort = (
  addressStr: string | null | undefined, 
  doorNum?: string | number | null
): { streetName: string; doorNumber: number } => {
  const clean = normalizeString(addressStr || '');
  if (!clean) {
    const num = doorNum ? parseInt(String(doorNum).replace(/\D/g, ''), 10) || 0 : 0;
    return { streetName: '', doorNumber: num };
  }

  const match = clean.match(/^(.*?)(?:\s*[-–—,]\s*|\s+)(\d+[a-z]*)$/i);
  if (match) {
    const street = match[1].trim();
    const num = parseInt(match[2].replace(/\D/g, ''), 10) || 0;
    return { streetName: street, doorNumber: num };
  }

  const num = doorNum ? parseInt(String(doorNum).replace(/\D/g, ''), 10) || 0 : 0;
  return { streetName: clean, doorNumber: num };
};

// Distância Haversine em metros entre dois pontos (lat1, lon1) e (lat2, lon2)
export const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Formatar distância em metros/km legível
export const formatDistance = (meters: number): string => {
  if (meters === 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};
