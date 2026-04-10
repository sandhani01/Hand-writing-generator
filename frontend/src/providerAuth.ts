import { isHostedAuthEnabled, supabaseConfig } from "./authConfig";

export type ProviderAuthResult = {
  accessToken: string;
  refreshToken: string | null;
};

type SupabaseAuthPayload = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  error_description?: string;
  msg?: string;
  error?: string;
  user?: {
    email?: string | null;
  };
};

function requireSupabaseConfig() {
  if (!isHostedAuthEnabled() || !supabaseConfig) {
    throw new Error(
      "Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return supabaseConfig;
}

async function parseSupabaseResponse(response: Response) {
  let payload: SupabaseAuthPayload | null = null;
  try {
    payload = (await response.json()) as SupabaseAuthPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.error_description ||
      payload?.msg ||
      payload?.error ||
      "Authentication with Supabase failed.";
    throw new Error(detail);
  }

  return payload ?? {};
}

function extractSession(payload: SupabaseAuthPayload, fallbackMessage: string): ProviderAuthResult {
  if (!payload.access_token) {
    if (payload.user?.email) {
      throw new Error(
        "Account created, but no session was returned. Check your email confirmation settings, then sign in."
      );
    }
    throw new Error(fallbackMessage);
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
  };
}

export async function signInWithSupabasePassword(
  email: string,
  password: string
): Promise<ProviderAuthResult> {
  const config = requireSupabaseConfig();
  const response = await fetch(
    `${config.url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
      },
      body: JSON.stringify({ email, password }),
    }
  );

  const payload = await parseSupabaseResponse(response);
  return extractSession(payload, "Supabase sign in did not return a session.");
}

export async function signUpWithSupabasePassword(
  email: string,
  password: string
): Promise<ProviderAuthResult> {
  const config = requireSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseSupabaseResponse(response);
  return extractSession(
    payload,
    "Supabase sign up did not return a session."
  );
}

export async function refreshSupabaseSession(
  refreshToken: string
): Promise<ProviderAuthResult> {
  const config = requireSupabaseConfig();
  const response = await fetch(
    `${config.url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.anonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  const payload = await parseSupabaseResponse(response);
  return extractSession(payload, "Supabase session refresh failed.");
}

export async function logoutSupabaseSession(accessToken: string): Promise<void> {
  const config = requireSupabaseConfig();
  await fetch(`${config.url}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
