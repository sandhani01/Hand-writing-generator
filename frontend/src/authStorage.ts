import type { AuthProviderMode, StoredAuthSession, UserProfile } from "./types";

const TOKEN_KEY = "handwritten-auth-token";
const REFRESH_TOKEN_KEY = "handwritten-auth-refresh-token";
const USER_KEY = "handwritten-auth-user";
const PROVIDER_KEY = "handwritten-auth-provider";

export function readStoredAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function readStoredRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function readStoredAuthProvider(): AuthProviderMode {
  const stored = window.localStorage.getItem(PROVIDER_KEY);
  return stored === "supabase" ? "supabase" : "local";
}

export function readStoredAuthUser(): UserProfile | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function readStoredAuthSession(): StoredAuthSession | null {
  const accessToken = readStoredAuthToken();
  const user = readStoredAuthUser();
  if (!accessToken || !user) {
    return null;
  }

  return {
    accessToken,
    refreshToken: readStoredRefreshToken(),
    provider: readStoredAuthProvider(),
    user,
  };
}

export function persistAuthSession(session: StoredAuthSession): void {
  window.localStorage.setItem(TOKEN_KEY, session.accessToken);
  if (session.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  window.localStorage.setItem(PROVIDER_KEY, session.provider);
}

export function persistAuthToken(accessToken: string, provider: AuthProviderMode): void {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(PROVIDER_KEY, provider);
}

export function persistAuthRefreshToken(refreshToken: string | null): void {
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function persistAuthUser(user: UserProfile): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}


export function clearStoredAuthSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(PROVIDER_KEY);
}
