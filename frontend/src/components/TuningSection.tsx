import { useId, useState } from "react";
import { SliderControl } from "./SliderControl";
import { WorkflowSection } from "./WorkflowSection";
import { CharacterOverridePanel } from "./CharacterOverridePanel";
import { ADVANCED_GROUPS, BASIC_CONTROLS } from "../renderControls";
import type {
  CharacterOverrideKey,
  NumericOptionKey,
  RenderOptions,
} from "../types";

type Props = {
  text: string;
  options: RenderOptions;
  defaultOptions: RenderOptions;
  supportsCharacterOverrides: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onApplyPreset: (preset: "neat" | "natural" | "compact") => void;
  onNumericChange: (key: NumericOptionKey, value: number) => void;
  onNumericReset: (key: NumericOptionKey) => void;
  onCharacterOverrideChange: (
    char: string,
    key: CharacterOverrideKey,
    value: number
  ) => void;
  onCharacterOverrideReset: (char: string) => void;
  onCharacterOverrideFieldReset: (
    char: string,
    key: CharacterOverrideKey
  ) => void;
  onInkColorChange: (color: string) => void;
  onInkColorReset: () => void;
  onCopyConfig: () => void;
  onApplyConfig: () => void;
  onResetAllFilters: () => void;
};

export function TuningSection({
  text,
  options,
  defaultOptions,
  supportsCharacterOverrides,
  showAdvanced,
  onToggleAdvanced,
  onApplyPreset,
  onNumericChange,
  onNumericReset,
  onCharacterOverrideChange,
  onCharacterOverrideReset,
  onCharacterOverrideFieldReset,
  onInkColorChange,
  onInkColorReset,
  onCopyConfig,
  onApplyConfig,
  onResetAllFilters,
}: Props) {
  const advancedRegionId = useId();
  const advancedLabelId = useId();
  const [expandedSubSections, setExpandedSubSections] = useState<Set<string>>(new Set());
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    onCopyConfig();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const toggleSubSection = (title: string) => {
    const next = new Set(expandedSubSections);
    if (next.has(title)) {
      next.delete(title);
    } else {
      next.add(title);
    }
    setExpandedSubSections(next);
  };

  const [isStyleExpanded, setIsStyleExpanded] = useState(false);

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="02"
        title="Adjust Style"
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleCopy}
              title="Copy current tuning configuration to clipboard"
            >
              {isCopied ? "Copied!" : "Copy Config"}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onApplyConfig}
              title="Apply a saved configuration JSON"
            >
              Import
            </button>
            <div className="workflow-actions__divider" aria-hidden="true" />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onResetAllFilters}
            >
              Reset
            </button>
            <div className="workflow-actions__divider" aria-hidden="true" />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setIsStyleExpanded(!isStyleExpanded)}
              aria-expanded={isStyleExpanded}
              title={isStyleExpanded ? "Collapse Section" : "Expand Section"}
              style={{ padding: '0 0.5rem' }}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ 
                  transform: isStyleExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        }
      >
        <div style={{ display: isStyleExpanded ? 'block' : 'none' }}>
        <div className="controls controls--basic">
          {BASIC_CONTROLS.map((control) => (
            <SliderControl
              key={control.key}
              config={control}
              options={options}
              defaultValue={defaultOptions[control.key]}
              onChange={onNumericChange}
              onReset={onNumericReset}
            />
          ))}
        </div>

        <div className="preset-panel" aria-label="Quick looks">
          <div className="preset-panel__copy">
            <h3 className="preset-panel__title">Quick Preset</h3>
            
          </div>
          <div className="preset-panel__actions">
            <button
              type="button"
              className="preset-chip"
              onClick={() => onApplyPreset("neat")}
            >
              Neat
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => onApplyPreset("natural")}
            >
              Natural
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => onApplyPreset("compact")}
            >
              Compact
            </button>
          </div>
        </div>

        <div className="advanced-bar">
          <div>
            <h3 id={advancedLabelId} className="advanced-bar__title">
              Advanced Options
            </h3>
            
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--collapse"
            onClick={onToggleAdvanced}
            aria-expanded={showAdvanced}
            aria-controls={advancedRegionId}
            aria-labelledby={advancedLabelId}
          >
            <span
              className="btn__chevron"
              data-open={showAdvanced}
              aria-hidden
            />
            {showAdvanced ? "Hide Advanced" : "Advanced"}
          </button>
        </div>

        <div
          id={advancedRegionId}
          className={`advanced-panel ${showAdvanced ? "is-open" : ""}`}
          role="region"
          aria-labelledby={advancedLabelId}
          inert={showAdvanced ? undefined : true}
        >
          <div className="control-group control-group--ink">
            <header 
              className="control-group__header control-group__header--clickable"
              onClick={() => toggleSubSection("Ink Color")}
            >
              <h3 className="control-group__title">Ink color</h3>
              <button
                type="button"
                className="btn btn--collapse btn--collapse-mini"
                aria-expanded={expandedSubSections.has("Ink Color")}
              >
                <span
                  className="btn__chevron"
                  data-open={expandedSubSections.has("Ink Color")}
                  aria-hidden
                />
              </button>
            </header>
            {expandedSubSections.has("Ink Color") && (
              <div className="color-control">
                <div className="color-control__header">
                  <span className="color-control__label">Choose ink color</span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--mini"
                    disabled={options.inkColor === defaultOptions.inkColor}
                    onClick={onInkColorReset}
                  >
                    Reset
                  </button>
                </div>
                <div className="color-control__row">
                  <input
                    type="color"
                    value={options.inkColor}
                    onChange={(event) => onInkColorChange(event.target.value)}
                    aria-label="Ink color"
                  />
                  <code>{options.inkColor}</code>
                </div>
              </div>
            )}
          </div>

          <section className="control-group control-group--character">
            <header 
              className="control-group__header control-group__header--clickable"
              onClick={() => toggleSubSection("Fix individual characters")}
            >
              <h3 className="control-group__title">Fix individual characters</h3>
              <button
                type="button"
                className="btn btn--collapse btn--collapse-mini"
                aria-expanded={expandedSubSections.has("Fix individual characters")}
              >
                <span
                  className="btn__chevron"
                  data-open={expandedSubSections.has("Fix individual characters")}
                  aria-hidden
                />
              </button>
            </header>
            {expandedSubSections.has("Fix individual characters") && (
              <CharacterOverridePanel
                text={text}
                charOverrides={options.charOverrides}
                isSupported={supportsCharacterOverrides}
                onChange={onCharacterOverrideChange}
                onReset={onCharacterOverrideReset}
                onResetField={onCharacterOverrideFieldReset}
              />
            )}
          </section>

          {ADVANCED_GROUPS.map((group) => (
            <section className="control-group" key={group.title}>
              <header 
                className="control-group__header control-group__header--clickable"
                onClick={() => toggleSubSection(group.title)}
              >
                <h3 className="control-group__title">{group.title}</h3>
                <button
                  type="button"
                  className="btn btn--collapse btn--collapse-mini"
                  aria-expanded={expandedSubSections.has(group.title)}
                >
                  <span
                    className="btn__chevron"
                    data-open={expandedSubSections.has(group.title)}
                    aria-hidden
                  />
                </button>
              </header>
              {expandedSubSections.has(group.title) && (
                <>
                  <p className="control-group__desc">{group.description}</p>
                  <div className="controls controls--advanced">
                    {group.controls.map((control) => (
                      <SliderControl
                        key={control.key}
                        config={control}
                        options={options}
                        defaultValue={defaultOptions[control.key]}
                        onChange={onNumericChange}
                        onReset={onNumericReset}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          ))}
        </div>

        </div>
      </WorkflowSection>
    </article>
  );
}
