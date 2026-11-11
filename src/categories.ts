import L from 'leaflet';
import { 
  Hospital, 
  Pill, 
  UtensilsCrossed, 
  Fuel, 
  Hotel,
  LucideIcon 
} from 'lucide-react';

export interface RecentSearchItem {
  term: string;
  categoryId?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string; // Tailwind class de fundo
  pinColor: string; // Hex color para o pino no mapa
  origem: string;
  query: string;
}

export const APPLE_CATEGORIES: CategoryItem[] = [
  { 
    id: 'farmacias', 
    name: 'Farmácias', 
    icon: Pill, 
    color: 'bg-rose-500', 
    pinColor: '#EC4899', 
    origem: 'tipo-farmacias',
    query: 'Farmácia' 
  },
  { 
    id: 'restaurantes', 
    name: 'Restaurantes', 
    icon: UtensilsCrossed, 
    color: 'bg-orange-500', 
    pinColor: '#F97316', 
    origem: 'tipo-restaurantes',
    query: 'Restaurante' 
  },
  { 
    id: 'postos', 
    name: 'Postos de Gasolina', 
    icon: Fuel, 
    color: 'bg-blue-600', 
    pinColor: '#0284C7', 
    origem: 'tipo-postos',
    query: 'Posto' 
  },
  { 
    id: 'hoteis', 
    name: 'Hotéis', 
    icon: Hotel, 
    color: 'bg-indigo-500', 
    pinColor: '#8B5CF6', 
    origem: 'tipo-hoteis',
    query: 'Hotel' 
  },
  { 
    id: 'hospitais', 
    name: 'Hospitais', 
    icon: Hospital, 
    color: 'bg-red-600', 
    pinColor: '#DC2626', 
    origem: 'tipo-saude',
    query: 'Hospital' 
  }
];

export const getCategoryConfig = (idOrOrigem?: string): CategoryItem | undefined => {
  if (!idOrOrigem) return undefined;
  const clean = idOrOrigem.toLowerCase().trim();
  return APPLE_CATEGORIES.find(c => 
    c.id.toLowerCase() === clean || 
    c.origem.toLowerCase() === clean ||
    c.query.toLowerCase() === clean
  );
};

/**
 * Detecta a categoria de um registro do CNEFE ou resultado de busca
 * a partir de campos de espécie, nome do estabelecimento, CNAE ou termos de busca.
 */
export const detectCategoryFromData = (row: any, fallbackTermOrOrigem?: string): string | undefined => {
  if (fallbackTermOrOrigem && fallbackTermOrOrigem.startsWith('tipo-')) {
    return fallbackTermOrOrigem;
  }

  // 1. Verificar pelo termo de busca (se fornecido)
  const term = String(fallbackTermOrOrigem || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (term.includes('saude') || term.includes('hospital')) return 'tipo-saude';
  if (term.includes('farmacia') || term.includes('drogaria')) return 'tipo-farmacias';
  if (term.includes('restaurante') || term.includes('churrascaria') || term.includes('pizzaria') || term.includes('lanchonete')) return 'tipo-restaurantes';
  if (term.includes('posto') || term.includes('gasolina') || term.includes('combustivel')) return 'tipo-postos';
  if (term.includes('hotel') || term.includes('pousada') || term.includes('hoteis')) return 'tipo-hoteis';

  if (!row) return undefined;

  // 2. Extrair dados da linha do CNEFE
  const estab = String(
    row.estabelecimento || 
    row.ESTABELECIMENTO || 
    row['Identificação do estabelecimento'] || 
    row['identificação do estabelecimento'] || 
    row['Identificação do Estabelecimento'] ||
    ''
  ).toLowerCase();

  const especie = String(
    row.especie || 
    row.ESPECIE || 
    row['Espécie de endereço'] || 
    row['espécie'] || 
    ''
  ).toLowerCase();

  const cnae = String(
    row.cnae || 
    row.CNAE || 
    row.cnae_subclasse || 
    row['CNAE'] || 
    ''
  ).toLowerCase();

  const desc = String(
    row.descricao || 
    row.DESCRICAO || 
    row.nome || 
    row.label || 
    ''
  ).toLowerCase();

  const combined = `${estab} ${especie} ${cnae} ${desc}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 2.1 Saúde / Hospitais
  if (
    combined.includes('estabelecimento de saude') ||
    combined.includes('hospital') ||
    combined.includes('ubs') ||
    combined.includes('unidade basica de saude') ||
    combined.includes('clinica medica') ||
    combined.includes('clinica odontologica') ||
    combined.includes('maternidade') ||
    combined.includes('pronto socorro') ||
    combined.includes('upa 24') ||
    combined.includes('samu') ||
    combined.includes('policlinica') ||
    combined.includes('laboratorio de analises') ||
    /\b(ubs|upa|hospital|maternidade)\b/.test(combined)
  ) {
    return 'tipo-saude';
  }

  // 2.2 Farmácias
  if (
    (combined.includes('farmacia') || 
     combined.includes('drogaria') || 
     combined.includes('drogasil') || 
     combined.includes('extrafarma') || 
     combined.includes('drogao') || 
     combined.includes('pague menos') || 
     combined.includes('farmaceutic')) &&
    !combined.includes('veterinari') && 
    !combined.includes('petshop') && 
    !combined.includes('pet shop')
  ) {
    return 'tipo-farmacias';
  }

  // 2.3 Postos de Gasolina
  if (
    (combined.includes('posto de gasolina') || 
     combined.includes('posto de combustivel') || 
     combined.includes('auto posto') || 
     combined.includes('combustiveis') || 
     combined.includes('gasolina') || 
     combined.includes('deriva de petroleo') || 
     combined.includes('ipiranga') || 
     combined.includes('petrobras') || 
     combined.includes('vibra') || 
     combined.includes('shell')) &&
    !combined.includes('posto de saude') && 
    !combined.includes('posto policial')
  ) {
    return 'tipo-postos';
  }

  // 2.4 Restaurantes / Alimentação
  if (
    combined.includes('restaurante') ||
    combined.includes('churrascaria') ||
    combined.includes('pizzaria') ||
    combined.includes('lanchonete') ||
    combined.includes('hamburgueria') ||
    combined.includes('pastelaria') ||
    combined.includes('bistro') ||
    combined.includes('petiscaria') ||
    combined.includes('self service') ||
    combined.includes('self-service') ||
    combined.includes('espetaria') ||
    combined.includes('refeicoes')
  ) {
    return 'tipo-restaurantes';
  }

  // 2.5 Hotéis / Hospedagem
  if (
    combined.includes('hotel') ||
    combined.includes('pousada') ||
    combined.includes('resort') ||
    combined.includes('hostel') ||
    combined.includes('motel') ||
    combined.includes('albergue') ||
    combined.includes('dormitorio') ||
    combined.includes('hospedagem')
  ) {
    return 'tipo-hoteis';
  }

  return undefined;
};

/**
 * Gera o DivIcon SVG padrão do Leaflet para o pino de cada categoria
 */
export const createCategoryPinIcon = (origemOrCatId?: string): L.DivIcon => {
  const cat = getCategoryConfig(origemOrCatId);

  let innerSvg = '';
  let pinColor = '#007AFF'; // Azul padrão

  if (cat?.origem === 'tipo-saude' || origemOrCatId === 'tipo-saude') {
    pinColor = '#DC2626';
    innerSvg = '<path d="M11 6.5H15V10.5H19V14.5H15V18.5H11V14.5H7V10.5H11V6.5Z" fill="#FFFFFF"/>';
  } else if (cat?.origem === 'tipo-farmacias' || origemOrCatId === 'tipo-farmacias') {
    pinColor = '#EC4899';
    innerSvg = '<path d="M10 15.5L16 9.5M8.5 11.5L11.5 8.5C12.8 7.2 15 7.2 16.3 8.5C17.6 9.8 17.6 12 16.3 13.3L13.3 16.3C12 17.6 9.8 17.6 8.5 16.3C7.2 15 7.2 12.8 8.5 11.5Z" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>';
  } else if (cat?.origem === 'tipo-restaurantes' || origemOrCatId === 'tipo-restaurantes') {
    pinColor = '#F97316';
    innerSvg = '<path d="M8.5 7V11M10.5 7V11M12.5 7V11M8.5 11C8.5 12.1 9.4 13 10.5 13V18M16.5 7V18M16.5 7C14.8 7 14.5 8.5 14.5 10.5C14.5 12 14.8 13 16.5 13" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
  } else if (cat?.origem === 'tipo-postos' || origemOrCatId === 'tipo-postos') {
    pinColor = '#0284C7';
    innerSvg = '<path d="M8 7.5H13.5V17.5H8V7.5Z" fill="#FFFFFF"/><path d="M13.5 9.5H15.5C16.6 9.5 17.5 10.4 17.5 11.5V15M17.5 15L15.5 13" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="9.2" y="9.2" width="3.1" height="2.5" rx="0.5" fill="#0284C7"/>';
  } else if (cat?.origem === 'tipo-hoteis' || origemOrCatId === 'tipo-hoteis') {
    pinColor = '#8B5CF6';
    innerSvg = '<circle cx="9" cy="11" r="1.3" fill="#FFFFFF"/><path d="M7 11V17M19 12.5V17M7 13.5H19M7 15.5H19" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/><path d="M11.5 13.5V11.2C11.5 10.5 12.2 10 13 10H16.5C17.3 10 18 10.5 18 11.2V13.5" fill="#FFFFFF"/>';
  } else {
    // Ponto padrão de endereço
    innerSvg = '<circle cx="13" cy="12.5" r="4.5" fill="#FFFFFF"/>';
  }

  return L.divIcon({
    className: 'custom-search-marker-pin',
    html: `
      <div style="width: 26px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 0C5.82 0 0 5.82 0 13C0 21.6 13 32 13 32C13 32 26 21.6 26 13C26 5.82 20.18 0 13 0Z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.5"/>
          ${innerSvg}
        </svg>
      </div>
    `,
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30]
  });
};
