import { useId } from "react";
import { SliderControl } from "./SliderControl";
import { WorkflowSection } from "./WorkflowSection";
import { ErrorBanner } from "./ErrorBanner";
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
  canRender: boolean;
  isRendering: boolean;
  onRender: () => void;
  renderError: string | null;
};

export function TuningSection({
  text,
  options,
  defaultOptions,
  supportsCharacterOverrides,
  showAdvanced,
  onToggleAdvanced,
  onNumericChange,
  onNumericReset,
  onCharacterOverrideChange,
  onCharacterOverrideReset,
  onCharacterOverrideFieldReset,
  onInkColorChange,
  onInkColorReset,
  onResetAllFilters,
  canRender,
  isRendering,
  onRender,
  renderError,
}: Props) {
  const advancedRegionId = useId();
  const advancedLabelId = useId();

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="03"
        title="Tuning"
        subtitle="Core spacing controls stay visible. Advanced groups ink, margins, and glyph families."
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onResetAllFilters}
            >
              Reset filters
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onRender}
              disabled={!canRender || isRendering}
              aria-busy={isRendering}
            >
              {isRendering ? "Rendering..." : "Render page"}
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

        <div className="advanced-bar">
          <div>
            <h3 id={advancedLabelId} className="advanced-bar__title">
              Advanced
            </h3>
            <p className="advanced-bar__text">
              Letter classes, page margins, drift, and ink texture.
            </p>
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
            {showAdvanced ? "Hide advanced" : "Show advanced"}
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

        {renderError ? <ErrorBanner>{renderError}</ErrorBanner> : null}
      </WorkflowSection>
    </article>
  );
}
