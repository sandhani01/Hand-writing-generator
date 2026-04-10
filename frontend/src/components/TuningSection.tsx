import { useId } from "react";
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
  onResetAllFilters,
}: Props) {
  const advancedRegionId = useId();
  const advancedLabelId = useId();

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="02"
        title="Tuning"
        
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onResetAllFilters}
            >
              Reset tuning
            </button>
          </div>
        }
      >
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
            <h3 className="preset-panel__title">Quick looks</h3>
            <p className="preset-panel__text">
              Start from a balanced preset, then refine with the sliders below.
            </p>
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
          <label className="color-control">
            <div className="color-control__header">
              <span className="color-control__label">Ink color</span>
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
          </label>

          <CharacterOverridePanel
            text={text}
            charOverrides={options.charOverrides}
            isSupported={supportsCharacterOverrides}
            onChange={onCharacterOverrideChange}
            onReset={onCharacterOverrideReset}
            onResetField={onCharacterOverrideFieldReset}
          />

          {ADVANCED_GROUPS.map((group) => (
            <section className="control-group" key={group.title}>
              <div className="control-group__header">
                <h3 className="control-group__title">{group.title}</h3>
                <p className="control-group__desc">{group.description}</p>
              </div>
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
            </section>
          ))}
        </div>

      </WorkflowSection>
    </article>
  );
}
