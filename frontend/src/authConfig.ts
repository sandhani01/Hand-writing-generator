import type { AuthProviderMode } from "./types";

type FrontendEnv = {
  VITE_API_BASE?: string;
  VITE_AUTH_PROVIDER?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

function readEnv(): FrontendEnv {
  return ((import.meta as unknown as { env?: FrontendEnv }).env ?? {}) as FrontendEnv;
}

function normalizeProvider(raw: string | undefined): AuthProviderMode | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "supabase") {
    return "supabase";
  }
  if (normalized === "local") {
    return "local";
  }
  return null;
}

const env = readEnv();
const explicitProvider = normalizeProvider(env.VITE_AUTH_PROVIDER);
const hasSupabaseConfig = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

export const authProvider: AuthProviderMode = "local";

export const authProviderLabel =
  authProvider === "supabase" ? "Supabase secured" : "Local account";

export const supabaseConfig =
  authProvider === "supabase" && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? {
        url: env.VITE_SUPABASE_URL.replace(/\/$/, ""),
        anonKey: env.VITE_SUPABASE_ANON_KEY,
      }
    : null;

export function isHostedAuthEnabled() {
  return authProvider === "supabase" && supabaseConfig !== null;
}
