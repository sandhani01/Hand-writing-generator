import type { NumericOptionKey, RenderOptions, SliderConfig } from "../types";
import { formatControlValue } from "../renderControls";

type Props = {
  config: SliderConfig;
  options: RenderOptions;
  defaultValue: number;
  onChange: (key: NumericOptionKey, value: number) => void;
  onReset: (key: NumericOptionKey) => void;
};

export function SliderControl({
  config,
  options,
  defaultValue,
  onChange,
  onReset,
}: Props) {
  const value = options[config.key];
  const valueText = formatControlValue(config, value);
  const rangeId = `control-range-${config.key}`;
  const hintId = `${rangeId}-hint`;
  const isDefault = Math.abs(value - defaultValue) <= config.step / 2;

  return (
    <div className="slider-card">
      <div className="slider-card__header">
        <label className="slider-card__label" htmlFor={rangeId}>
          {config.label}
        </label>
        <div className="slider-card__actions">
          <strong className="slider-card__value" aria-hidden>
            {valueText}
          </strong>
          <button
            type="button"
            className="btn btn--ghost btn--mini"
            disabled={isDefault}
            onClick={() => onReset(config.key)}
          >
            Reset
          </button>
        </div>
      </div>
      <input
        id={rangeId}
        type="range"
        className="slider-card__input"
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        aria-valuemin={config.min}
        aria-valuemax={config.max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-describedby={hintId}
        onChange={(event) => onChange(config.key, Number(event.target.value))}
      />
      <p id={hintId} className="slider-card__hint">
        {config.description}
      </p>
    </div>
  );
}
