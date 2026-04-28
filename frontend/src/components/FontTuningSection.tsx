import { useState } from "react";
import { WorkflowSection } from "./WorkflowSection";
import type { FontMetricsOptions } from "../types";

type Props = {
  metrics: FontMetricsOptions;
  onChange: (metrics: FontMetricsOptions) => void;
};

const DEFAULT_METRICS: FontMetricsOptions = {
  ascent: 800,
  descent: -200,
  capHeight: 700,
  xHeight: 500,
  lineGap: 0,
  letterSpacing: 1.0,
  strokeGain: 1.0,
  smoothing: 1.0,
  horizontalScale: 1.0,
};

export function FontTuningSection({ metrics, onChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key: keyof FontMetricsOptions, value: number) => {
    onChange({ ...metrics, [key]: value });
  };

  const handleReset = (key: keyof FontMetricsOptions) => {
    handleChange(key, DEFAULT_METRICS[key]);
  };

  const controls = [
    { key: "ascent", label: "Ascent", min: 500, max: 1200, step: 10, description: "Height of tallest letters above baseline." },
    { key: "descent", label: "Descent", min: -500, max: 0, step: 10, description: "Depth of hanging letters (g, j, p, q, y)." },
    { key: "capHeight", label: "Cap Height", min: 400, max: 1000, step: 10, description: "Height of uppercase letters." },
    { key: "xHeight", label: "X-Height", min: 300, max: 800, step: 10, description: "Height of lowercase letters (x, a, e)." },
    { key: "letterSpacing", label: "Letter Spacing", min: 0.5, max: 2.5, step: 0.05, description: "Global multiplier for spacing between letters.", format: (v: number) => `${v}x` },
    { key: "strokeGain", label: "Stroke Weight", min: 0.5, max: 2.0, step: 0.05, description: "Adjust the thickness of the ink strokes.", format: (v: number) => `${v}x` },
    { key: "smoothing", label: "Smoothing", min: 0.0, max: 2.0, step: 0.1, description: "How much to smooth out the jagged ink lines.", format: (v: number) => `${v}x` },
    { key: "horizontalScale", label: "Horizontal Scale", min: 0.5, max: 1.5, step: 0.05, description: "Stretch or squeeze the width of the characters.", format: (v: number) => `${v}x` },
    { key: "lineGap", label: "Line Gap", min: 0, max: 500, step: 10, description: "Extra space between lines." },
  ];

  return (
    <article className="surface surface--raised">
      <WorkflowSection
        step="02"
        title="Metric Tuning"
        className="workflow-section--tuning"
        headerExtra={
          <div className="workflow-actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onChange(DEFAULT_METRICS)}
            >
              Reset All
            </button>
            <div className="workflow-actions__divider" aria-hidden="true" />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              title={isExpanded ? "Collapse Section" : "Expand Section"}
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
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease'
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        }
      >
        <div style={{ display: isExpanded ? 'block' : 'none', marginTop: '1.5rem' }}>
          <p className="font-tuning-intro" style={{ marginBottom: '1.5rem', opacity: 0.8, fontSize: '0.9rem' }}>
            Fine-tune the height, descent, and side-bearings of your glyphs. 
            Adjusting these parameters makes your handwritten font look professional and natural.
          </p>
          
          <div className="controls controls--basic">
            {controls.map((control) => {
              const value = metrics[control.key as keyof FontMetricsOptions];
              const isDefault = value === DEFAULT_METRICS[control.key as keyof FontMetricsOptions];
              const displayValue = control.format ? control.format(value) : value;

              return (
                <div key={control.key} className="slider-card">
                  <div className="slider-card__header">
                    <label className="slider-card__label">
                      {control.label}
                    </label>
                    <div className="slider-card__actions">
                      <strong className="slider-card__value" aria-hidden>
                        {displayValue}
                      </strong>
                      <button
                        type="button"
                        className="btn btn--ghost btn--mini"
                        disabled={isDefault}
                        onClick={() => handleReset(control.key as keyof FontMetricsOptions)}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="slider-card__input"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value}
                    onChange={(e) => handleChange(control.key as keyof FontMetricsOptions, parseFloat(e.target.value))}
                  />
                  <p className="slider-card__hint">
                    {control.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </WorkflowSection>
    </article>
  );
}
