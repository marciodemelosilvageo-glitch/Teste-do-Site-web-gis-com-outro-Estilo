/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// URL base do Supabase (com sanitização e suporte aos nomes site_suba e VITE_SUPABASE_URL)
const env = (import.meta as any).env || {};
const rawUrl = (
  env.site_suba ||
  env.VITE_site_suba ||
  env.VITE_SUPABASE_URL ||
  'https://qsstrhxeesbvfnxuiibj.supabase.co'
).trim();
export const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

const rawKey = (
  env.suba_anon ||
  env.VITE_suba_anon ||
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzc3RyaHhlZXNidmZueHVpaWJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5MTM2NTksImV4cCI6MjExMDQ4OTY1OX0.fP7Wc3fNV64iNAn91aWDLPpMJYeQOhr-u1yhMY9_SvU'
).trim();
export const SUPABASE_ANON_KEY = rawKey;

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
