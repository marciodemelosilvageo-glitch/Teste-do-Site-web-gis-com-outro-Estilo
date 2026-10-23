import L from 'leaflet';

// ---------- Dicionários Oficiais (Censo / IBGE) ----------
export const situationMap: Record<string, string> = {
  "1": "Área urbana de alta densidade de edificações",
  "2": "Área urbana de baixa densidade de edificações",
  "3": "Núcleo urbano",
  "4": "Área rural (exclusive aglomerados)", 
  "5": "Aglomerado rural - Povoado",
  "6": "Aglomerado rural - Núcleo rural",
  "7": "Aglomerado rural - Lugarejo",
  "8": "Área rural (exclusive aglomerados)",
  "9": "Massas de água"
};

export const typeMap: Record<string, string> = {
  "0": "Não especial",
  "1": "Favela e Comunidade Urbana",
  "2": "Quartel e base militar",
  "3": "Alojamento / acampamento",
  "4": "Setor com baixo patamar domiciliar",
  "5": "Agrupamento indígena",
  "6": "Unidade prisional",
  "7": "Convento/hospital/ILPI/IACA",
  "8": "Agrovila do PA",
  "9": "Agrupamento quilombola"
};

// Nomes amigáveis para as propriedades das tabelas e KML/CSV
export const propertyNames: Record<string, string> = {
  'CD_SETOR': 'Geocódigo de Setor Censitário',
  'SITUACAO': 'Situação (Urbana/Rural)',
  'CD_SIT': 'Situação Detalhada', 
  'CD_TIPO': 'Tipo do Setor', 
  'Risp': 'RISP',
  'Area de desenvolvimento': 'Área de Desenvolvimento',
  'AREA_KM2': 'Área (km²)',
  'CD_REGIAO': 'Código da Grande Região',
  'NM_REGIAO': 'Nome da Grande Região',
  'CD_UF': 'Código da UF',
  'NM_UF': 'Nome da UF',
  'CD_MUN': 'Código do Município',
  'NM_MUN': 'Nome do Município',
  'CD_DIST': 'Código do Distrito',
  'NM_DIST': 'Nome do Distrito',
  'CD_SUBDIST': 'Código do Subdistrito',
  'NM_SUBDIST': 'Nome do Subdistrito',
  'CD_BAIRRO': 'Código do Bairro',
  'NM_BAIRRO': 'Nome do Bairro',
  'CD_NU': 'Código do Núcleo Urbano',
  'NM_NU': 'Nome do Núcleo Urbano',
  'CD_FCU': 'Código da Favela/Com. Urbana',
  'NM_FCU': 'Nome da Favela/Com. Urbana',
  'CD_AGLOM': 'Código do Aglomerado',
  'NM_AGLOM': 'Nome do Aglomerado',
  'CD_RGINT': 'Código da RG Intermediária',
  'NM_RGINT': 'Nome da RG Intermediária',
  'CD_RGI': 'Código da RG Imediata',
  'NM_RGI': 'Nome da RG Imediata',
  'CD_CONCURB': 'Código da Concentração Urbana',
  'NM_CONCURB': 'Nome da Concentração Urbana',
  'NM_TIPO': 'Tipo Descritivo',
  'NM_SIT': 'Situação Descritiva',
  'Aisp': 'AISP',
  'V0001': 'Total de pessoas',
  'V0002': 'Total de Domicílios (Particulares + Coletivos)',
  'V0003': 'Total de Domicílios Particulares',
  'V0004': 'Total de Domicílios Coletivos',
  'V0005': 'Média de moradores em Dom. Particulares Ocupados',
  'V0006': 'Percentual de Dom. Particulares Ocupados Imputados',
  'V0007': 'Total de Domicílios Particulares Ocupados',
  'Total de pessoas': 'Total de pessoas',
  'Nome': 'Nome',
  'Nome do município': 'Nome do Município',
  'CEP': 'CEP',
  'Localidade': 'Localidade',
  'LATITUDE': 'Latitude (Y)',
  'LONGITUDE': 'Longitude (X)',
  'Agromerado': 'Aglomerado',
  'id_Localidades': 'ID Localidades',
  'Código único do endereço': 'Código Único do Endereço',
  'Nome do subdistrito': 'Nome do Subdistrito',
  'Endereco': 'Endereço',
  'Endereço': 'Endereço',
  'Complemento': 'Complemento',
  'Identificação do estabelecimento': 'Identificação do Estabelecimento'
};

// ---------- Estilos e Legendas Temáticas (Paleta Apple Maps / iOS HIG) ----------
export const layerColors: Record<string, string> = {
  "Municipios": "#007AFF",                     // Apple Blue
  "Bairros": "#5856D6",                        // Apple Indigo
  "AISP": "#AF52DE",                           // Apple Purple
  "Aglomerados Rurais": "#FF9500",             // Apple Orange
  "Áreas de Desenvolvimento": "#FFCC00",       // Apple Yellow
  "Comunidades Rurais de Teresina": "#34C759",  // Apple Green
  "Favelas e Comunidades": "#FF2D55",          // Apple Pink / Rose
  "Localidades (Piauí)": "#FF3B30",            // Apple Red
  "Núcleos Urbanos": "#30B0C7",                // Apple Teal
  "RISP": "#00C7BE"                            // Apple Mint
};

export const getLayerColor = (layerName: string): string => {
  return layerColors[layerName] || "#8E8E93"; // Apple System Gray padrão
};

// Cria estilo uniforme estilo Apple Maps: tons pastéis translúcidos elegantes com borda nítida
export const createUniformStyle = (layerName: string) => (_f: any): L.PathOptions => ({
  fillColor: getLayerColor(layerName),
  weight: layerName === "Municipios" ? 2 : 1.5,
  opacity: 0.88, // Borda limpa e nítida
  color: getLayerColor(layerName), // Cor padrão da borda igual à cor da camada
  fillOpacity: layerName === "Municipios" ? 0 : 0.14,  // Preenchimento sutil translúcido Apple
  dashArray: ''
});

export const thematicStylePoints = (_f: any): L.CircleMarkerOptions => ({
  radius: 5,
  fillColor: getLayerColor("Localidades (Piauí)"),
  color: "#ffffff",
  weight: 1.5,
  opacity: 0.95,
  fillOpacity: 0.88
});

export const layerStyles: Record<string, (f: any) => L.PathOptions> = {
  "AISP": createUniformStyle("AISP"),
  "Aglomerados Rurais": createUniformStyle("Aglomerados Rurais"),
  "Áreas de Desenvolvimento": createUniformStyle("Áreas de Desenvolvimento"),
  "Bairros": createUniformStyle("Bairros"),
  "Comunidades Rurais de Teresina": createUniformStyle("Comunidades Rurais de Teresina"),
  "Favelas e Comunidades": createUniformStyle("Favelas e Comunidades"),
  "Localidades (Piauí)": thematicStylePoints as any,
  "Municipios": createUniformStyle("Municipios"),
  "Núcleos Urbanos": createUniformStyle("Núcleos Urbanos"),
  "RISP": createUniformStyle("RISP"),
  // Fallbacks históricos
  "Situação (Urbana/Rural)": createUniformStyle("Municipios"),
  "Situação detalhada - Nivel Municipio": createUniformStyle("Municipios"),
  "Situação detalhada - Nivel Bairros": createUniformStyle("Bairros"),
  "Tipo do Setor - Nivel Municipio": createUniformStyle("Municipios"),
  "Tipo do Setor - Nivel Bairros": createUniformStyle("Bairros")
};

// ---------- Definição de Fontes de Dados (GeoJSON) ----------
export const dataSources = [
  { name: "AISP", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/Aisp.geojson', popupProperty: 'Aisp' },
  { name: "Aglomerados Rurais", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/NM_AGLOM.geojson', popupProperty: 'NM_AGLOM' },
  { name: "Áreas de Desenvolvimento", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/Area%20de%20desenvolvimento.geojson', popupProperty: 'Area de desenvolvimento' },
  { name: "Bairros", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/NM_BAIRRO.geojson', popupProperty: 'NM_BAIRRO' },
  { name: "Comunidades Rurais de Teresina", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/Comunidades%20rurais%20de%20teresina.geojson', popupProperty: 'Nome' },
  { name: "Favelas e Comunidades", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/NM_FCU.geojson', popupProperty: 'NM_FCU' },
  { name: "Localidades (Piauí)", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web_Gis_Pesquisa/main/povoados/Localidades.geojson', popupProperty: 'Localidade' },
  { name: "Municipios", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/NM_MUN.geojson', popupProperty: 'NM_MUN' },
  { name: "Núcleos Urbanos", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/NM_NU.geojson', popupProperty: 'NM_NU' },
  { name: "RISP", url: 'https://raw.githubusercontent.com/marciodemelosilvageo-glitch/web/main/geojsom/Risp.geojson', popupProperty: 'Risp' }
].map(s => ({
  ...s,
  style: layerStyles[s.name] || createUniformStyle(s.name)
}));

// Chaves para identificação direta do nome da feição por prioridade máxima
export const PRIORITY_KEYS = [
  'NM_MUN', 'Nome do município', 'nome do município', 'Nome do municipio', 'nome do municipio', 'MUNICIPIO', 'Municipio', 'municipio', 'NM_MUNICIP',
  'NM_BAIRRO', 'Bairro', 'bairro', 'BAIRRO', 'Nome do bairro',
  'NM_FCU', 'Favela', 'favela', 'Nome da favela',
  'Localidade', 'localidade', 'LOCALIDADE', 'NM_LOCALIDA', 'NM_LOCALIDADE', 'Nome_Localidade', 'NOME_LOCALIDADE',
  'NM_NU', 'Núcleo Urbano', 'nucleo urbano',
  'NM_AGLOM', 'Aglomerado', 'aglomerado', 'AGLOMERADO', 'Agromerado', 'agromerado',
  'Identificação do estabelecimento', 'identificação do estabelecimento', 'identificacao do estabelecimento', 
  'Endereco', 'Endereço', 'endereco', 'endereço', 
  'Nome', 'nome', 'NOME', 'Name',
  'Area de desenvolvimento', 'Área de desenvolvimento',
  'Aisp', 'AISP', 'aisp', 'Risp', 'RISP', 'risp'
];

export const CODE_KEYS = ['CD_MUN', 'CD_BAIRRO', 'CD_FCU', 'Cod_Risp'];

// Lista oficial das 7 Camadas Ativas Padrão do WebGIS ao entrar no sistema
export const DEFAULT_ACTIVE_LAYERS = [
  'Localidades (Piauí)',
  'Núcleos Urbanos',
  'Comunidades Rurais de Teresina',
  'Aglomerados Rurais',
  'Favelas e Comunidades',
  'Bairros',
  'Municipios'
];
