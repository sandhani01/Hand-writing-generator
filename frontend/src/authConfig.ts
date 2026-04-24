import type { AuthProviderMode } from "./types";

type FrontendEnv = {
  VITE_API_BASE?: string;
  VITE_AUTH_PROVIDER?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export const authProvider: AuthProviderMode = "local";

export const authProviderLabel = "Local account";

export const supabaseConfig = null;

export function isHostedAuthEnabled() {
  return false;
}
