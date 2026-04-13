import { useState } from "react";
import type { RenderOptions } from "../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (options: RenderOptions) => void;
  normalizeRenderOptions: (options?: any) => RenderOptions;
};

export function ImportConfigModal({
  isOpen,
  onClose,
  onApply,
  normalizeRenderOptions,
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!inputValue.trim()) {
      setError("Please paste a configuration JSON string.");
      return;
    }

    try {
      const parsed = JSON.parse(inputValue);
      const normalized = normalizeRenderOptions(parsed);
      onApply(normalized);
      setInputValue("");
      setError(null);
      onClose();
    } catch (err) {
      setError("Invalid JSON format. Please check your configuration string.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
      <div className="modal modal--import surface surface--raised">
        <div className="modal__header">
          <div className="modal__title-group">
            <h2 id="import-modal-title" className="modal__title">Import Configuration</h2>
            <p className="modal__subtitle">Paste a JSON string to apply fine-tuning presets.</p>
          </div>
          <button type="button" className="btn btn--ghost btn--mini modal__close" onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal__body">
          <label className="import-label">
            <span className="import-label__text">Configuration JSON</span>
            <textarea
              className="import-area"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder='{ "lineHeight": 82, ... }'
              spellCheck={false}
              autoFocus
            />
          </label>

          {error && (
            <div className="modal-error" role="alert">
              <svg className="modal-error__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleApply}>
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
