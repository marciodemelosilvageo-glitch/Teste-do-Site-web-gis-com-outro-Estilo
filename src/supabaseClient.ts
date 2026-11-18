/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// URL base do Supabase (com sanitização e suporte aos nomes site_suba e VITE_SUPABASE_URL)
const env = (import.meta as any).env || {};
const rawUrl = (
  env.site_suba ||
  env.VITE_site_suba ||
  env.VITE_SUPABASE_URL ||
  ''
).trim();

const rawKey = (
  env.suba_anon ||
  env.VITE_suba_anon ||
  env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

if (!rawUrl || !rawKey) {
  console.error(
    '❌ [WebGIS] Variáveis de ambiente do Supabase não configuradas! ' +
    'Defina VITE_SUPABASE_URL (ou site_suba) e VITE_SUPABASE_ANON_KEY (ou suba_anon) no seu arquivo .env ou no painel da Vercel.'
  );
}

// Higieniza a URL removendo barras e sufixos desnecessários
export const SUPABASE_URL = (rawUrl || 'https://placeholder.supabase.co')
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '');

export const SUPABASE_ANON_KEY = rawKey || 'placeholder-anon-key';

export const SYNTHETIC_EMAIL_DOMAIN = '@usuarios.webgis';

export const toSyntheticEmail = (username: string): string => {
  const clean = (username || '').trim().toLowerCase().replace(/^@+/, '').trim();
  return `${clean}${SYNTHETIC_EMAIL_DOMAIN}`;
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: { schema: 'public' }
});
