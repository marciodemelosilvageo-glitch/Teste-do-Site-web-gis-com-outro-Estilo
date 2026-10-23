/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// URL base do Supabase (com sanitização para remover /rest/v1 duplicado ou barras no final caso venham da Vercel)
const rawUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://uvaffemgnmfldpedhlgu.supabase.co').trim();
const SUPABASE_URL = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

const rawKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2YWZmZW1nbm1mbGRwZWRobGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MzM4MDYsImV4cCI6MjEwMzAwOTgwNn0.0LMU06tjxS1SSiMm-EvvW9RSNKr2D9k-A-tT-Tt2Vro').trim();
const SUPABASE_ANON_KEY = rawKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

