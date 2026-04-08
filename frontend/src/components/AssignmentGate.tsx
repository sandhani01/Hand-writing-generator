import { AssignmentModePicker } from "./AssignmentModePicker";
import { ThemeToggle } from "./ThemeToggle";
import type { AssignmentMode } from "../types";

type Props = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSelectMode: (mode: AssignmentMode) => void;
};

export function AssignmentGate({ theme, onToggleTheme, onSelectMode }: Props) {
  return (
    <div className="app app--gate">
      <a className="skip-link" href="#assignment-picker">
        Skip to choices
      </a>
      <div className="gate-topbar">
        <span className="gate-brand">Handwritten Notes</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <AssignmentModePicker onSelect={onSelectMode} />
    </div>
  );
}
