import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || ''
).trim();

const hasPlaceholderKey = /^TU_.*_AQUI$/i.test(supabaseAnonKey);

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export const supabaseConfigError = hasPlaceholderKey
  ? 'Reemplaza la clave de ejemplo en .env.local por una clave pública de Supabase.'
  : !supabaseUrl || !supabaseAnonKey
    ? 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.'
  : !isValidSupabaseUrl(supabaseUrl)
    ? 'VITE_SUPABASE_URL debe ser una URL HTTP o HTTPS válida.'
    : null;

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'El cliente de Supabase no está disponible.');
  }
  return supabase;
}
