type Props = {
  children: string;
  /** assertive for immediate errors; polite for non-critical */
  politeness?: "assertive" | "polite";
};

/**
 * Inline error / warning with live region for screen readers.
 */
export function ErrorBanner({ children, politeness = "assertive" }: Props) {
  return (
    <div
      className="error-banner"
      role="alert"
      aria-live={politeness}
    >
      {children}
    </div>
  );
}
