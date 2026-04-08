import type { NumericOptionKey, RenderOptions, SliderConfig } from "../types";
import { formatControlValue } from "../renderControls";

type Props = {
  config: SliderConfig;
  options: RenderOptions;
  onChange: (key: NumericOptionKey, value: number) => void;
};

export function SliderControl({ config, options, onChange }: Props) {
  const value = options[config.key];
  const valueText = formatControlValue(config, value);
  const rangeId = `control-range-${config.key}`;
  const hintId = `${rangeId}-hint`;

  return (
    <div className="slider-card">
      <div className="slider-card__header">
        <label className="slider-card__label" htmlFor={rangeId}>
          {config.label}
        </label>
        <strong className="slider-card__value" aria-hidden>
          {valueText}
        </strong>
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
