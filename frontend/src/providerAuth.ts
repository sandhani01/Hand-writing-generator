export type ProviderAuthResult = {
  accessToken: string;
  refreshToken: string | null;
};

export async function signInWithSupabasePassword(
  _email: string,
  _password: string
): Promise<ProviderAuthResult> {
  throw new Error("Supabase auth is disabled.");
}

export async function signUpWithSupabasePassword(
  _email: string,
  _password: string
): Promise<ProviderAuthResult> {
  throw new Error("Supabase auth is disabled.");
}

export async function refreshSupabaseSession(
  _refreshToken: string
): Promise<ProviderAuthResult> {
  throw new Error("Supabase auth is disabled.");
}

export async function logoutSupabaseSession(_accessToken: string): Promise<void> {
  // Supabase auth is disabled
}
