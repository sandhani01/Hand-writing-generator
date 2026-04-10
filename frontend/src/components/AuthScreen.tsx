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
        ? "Sign in, upload your sheets for this session, and render pages without permanent dataset storage."
        : "Create an account, then upload your alphabet, coding, and background sheets each time you start a new workspace.",
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
          <div className="auth-panel__header">
            <div className="auth-panel__icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </div>
            <div className="auth-panel__copy">
              <p className="auth-panel__eyebrow">Handwriting Workspace</p>
              <h1 className="auth-panel__title" id="auth-title">
                {heading}
              </h1>
              <p className="auth-panel__lede">{subtitle}</p>
            </div>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => setMode("login")}
              aria-pressed={mode === "login"}
            >
              <svg className="auth-tab__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" x2="3" y1="12" y2="12" />
              </svg>
              Sign in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => setMode("signup")}
              aria-pressed={mode === "signup"}
            >
              <svg className="auth-tab__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-field__label">Email address</span>
              <div className="auth-field__input-wrapper">
                <svg className="auth-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label className="auth-field">
              <span className="auth-field__label">Password</span>
              <div className="auth-field__input-wrapper">
                <svg className="auth-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
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
              </div>
            </label>

            {error ? (
              <div className="auth-error" role="alert">
                <svg className="auth-error__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn--primary btn--block btn--lg"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="btn__icon btn__icon--spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                mode === "login" ? "Sign in" : "Create account"
              )}
            </button>
          </form>

          <p className="auth-panel__meta">
            {providerMode === "supabase"
              ? `Powered by ${providerLabel}. Your datasets are stored only for the current workspace session.`
              : `${providerLabel}. Local development mode.`}
          </p>
        </div>
      </section>
    </div>
  );
}
