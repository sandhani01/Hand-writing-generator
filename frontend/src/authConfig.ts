import type { AuthProviderMode } from "./types";


export const authProvider: AuthProviderMode = "local";

export const authProviderLabel = "Local account";

export const supabaseConfig = null;

export function isHostedAuthEnabled() {
  return false;
}
