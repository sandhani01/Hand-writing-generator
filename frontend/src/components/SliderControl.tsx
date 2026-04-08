import type { NumericOptionKey, RenderOptions, SliderConfig } from "../types";
import { formatControlValue } from "../renderControls";

type Props = {
  config: SliderConfig;
  options: RenderOptions;
  onChange: (key: NumericOptionKey, value: number) => void;
};

export function SliderControl({ config, options, onChange }: Props) {
  return (
    <label className="slider-card">
      <div className="slider-card__header">
        <span>{config.label}</span>
        <strong>{formatControlValue(config, options[config.key])}</strong>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={options[config.key]}
        onChange={(event) => onChange(config.key, Number(event.target.value))}
      />
      <small>{config.description}</small>
    </label>
  );
}
