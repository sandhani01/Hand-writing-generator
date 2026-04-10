import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ThemeToggle } from "./ThemeToggle";
import type { UserProfile } from "../types";

type AuthMode = "login" | "signup";

type Props = {
  theme: "dark" | "light";
  isSubmitting: boolean;
  error: string | null;
  lastUser: UserProfile | null;
  providerLabel: string;
  providerMode: "local" | "supabase";
  onToggleTheme: () => void;
  onSubmit: (mode: AuthMode, email: string, password: string) => Promise<void>;
};

export function AuthScreen({
  theme,
  isSubmitting,
  error,
  lastUser,
  providerLabel,
  providerMode,
  onToggleTheme,
  onSubmit,
}: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(lastUser?.email ?? "");
  const [password, setPassword] = useState("");

  const heading = useMemo(
    () =>
      mode === "login"
        ? "Sign in to your handwriting workspace"
        : "Create your handwriting workspace",
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Your datasets, renders, and tuning history live behind your account now."
        : "Create an account to keep your alphabet, coding, and background datasets in one place.",
    [mode]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(mode, email, password);
    setPassword("");
  };

  return (
    <div className="app app--gate">
      <a className="skip-link" href="#auth-panel">
        Skip to sign in form
      </a>
      <div className="gate-topbar">
        <span className="gate-brand">Handwritten Notes</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <section className="auth-shell" aria-labelledby="auth-title">
        <div className="auth-panel surface surface--raised" id="auth-panel">
          <div className="auth-panel__copy">
            <p className="app-header__eyebrow">Hosted Workspace</p>
            <h1 className="auth-panel__title" id="auth-title">
              {heading}
            </h1>
            <p className="auth-panel__lede">{subtitle}</p>
            <p className="auth-panel__meta">
              {providerMode === "supabase"
                ? `${providerLabel}. Sign in here, then the backend uses your bearer token for datasets and renders.`
                : `${providerLabel}. This mode is useful for local development before hosted auth is configured.`}
            </p>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => setMode("login")}
              aria-pressed={mode === "login"}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => setMode("signup")}
              aria-pressed={mode === "signup"}
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
