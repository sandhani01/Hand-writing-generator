import { AssignmentModePicker } from "./AssignmentModePicker";
import { ThemeToggle } from "./ThemeToggle";
import type { AssignmentMode } from "../types";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSelectMode: (mode: AssignmentMode) => void;
  onOpenDemo: (variant?: "standard" | "font") => void;
  onLogout: () => void;
  initialTemplatesView?: boolean;
};

export function AssignmentGate({
  theme,
  onToggleTheme,
  onSelectMode,
  onOpenDemo,
  initialTemplatesView = false,
}: Omit<Props, "onLogout">) {
  return (
    <div className="app app--gate">
      <a className="skip-link" href="#notes-picker">
        Skip to choices
      </a>
      <div className="gate-topbar">
        <span className="gate-brand">Handwritten-Notes</span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <AssignmentModePicker
        onSelect={onSelectMode}
        onOpenDemo={onOpenDemo}
        initialTemplatesView={initialTemplatesView}
      />
    </div>
  );
}
