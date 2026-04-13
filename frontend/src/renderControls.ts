import type {
  CharacterOverride,
  CharacterSliderConfig,
  RenderOptions,
  SliderConfig,
  ControlGroup,
} from "./types";

export const DEFAULT_TEXT_SIMPLE = `Every brave cat danced eagerly for gentle heroes.

Middle letters stay compact, tall letters rise up, and descenders drop lower.
0123456789`;

/** @deprecated Use DEFAULT_TEXT_SIMPLE */
export const DEFAULT_TEXT = DEFAULT_TEXT_SIMPLE;

export const DEFAULT_TEXT_CODING = `function estimatePi(iterations: number) {
  let sum = 0;
  for (let k = 0; k < iterations; k++) {
    sum += (-1) ** k / (2 * k + 1);
  }
  return 4 * sum;
}

// Notes: brackets, operators, and symbols use the coding grid.`;

export const FALLBACK_OPTIONS: RenderOptions = {
  lineHeight: 82,
  charSpacing: -1,
  wordSpacing: 26,
  jitter: 0,
  inkColor: "#0f1e50",
  overallScale: 1.42,
  marginLeft: 100,
  marginTop: 180,
  marginRight: 30,
  marginBottom: 180,
  baselineJitter: 0.25,
  lineDriftPerWord: 0.18,
  wordSpacingJitter: 3,
  rotation: 2,
  pressureMin: 0.9,
  pressureMax: 0.98,
  strokeGain: 1.28,
  edgeRoughness: 0,
  textureBlend: 0.08,
  upperScale: 1,
  ascenderScale: 1,
  xHeightScale: 1,
  descenderScale: 1,
  descenderShift: 0,
  digitScale: 1,
  symbolScale: 1,
  commaScale: 1,
  commaShift: 0,
  dotScale: 1,
  charOverrides: {},
};

export const EMPTY_CHARACTER_OVERRIDE: CharacterOverride = {
  scaleMultiplier: 1,
  widthMultiplier: 1,
  baselineShift: 0,
  strokeGainMultiplier: 1,
  spacingBeforeDelta: 0,
  spacingDelta: 0,
};

export const BASIC_CONTROLS: SliderConfig[] = [
  {
    key: "lineHeight",
    label: "Line height",
    min: 40,
    max: 180,
    step: 1,
    description: "Vertical spacing between rendered lines.",
  },
  {
    key: "charSpacing",
    label: "Letter spacing",
    min: -12,
    max: 30,
    step: 1,
    description: "Spacing between letters inside a word.",
  },
  {
    key: "wordSpacing",
    label: "Word spacing",
    min: 8,
    max: 70,
    step: 1,
    description: "Extra gap for spaces in your text.",
  },

];

export const ADVANCED_GROUPS: ControlGroup[] = [
  {
    title: "Letter Families",
    description:
      "Adjust letter shapes: middle letters, ascenders, descenders, digits, and punctuation.",
    controls: [
      {
        key: "xHeightScale",
        label: "Middle letters",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "a c e m n o r s u v w x z",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "ascenderScale",
        label: "Tall letters",
        min: 0.6,
        max: 1.7,
        step: 0.01,
        description: "b d f h k l t",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "descenderScale",
        label: "Descenders",
        min: 0.6,
        max: 1.8,
        step: 0.01,
        description: "g j p q y",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "descenderShift",
        label: "Descender drop",
        min: -8,
        max: 28,
        step: 1,
        description: "Moves descenders farther below the baseline.",
      },
      {
        key: "upperScale",
        label: "Uppercase size",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "Scale for A-Z.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "digitScale",
        label: "Digit size",
        min: 0.6,
        max: 1.6,
        step: 0.01,
        description: "Scale for 0-9.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "symbolScale",
        label: "Symbol size",
        min: 0.6,
        max: 1.9,
        step: 0.01,
        description: "Scale for coding symbols and punctuation marks.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "commaScale",
        label: "Comma size",
        min: 0.5,
        max: 1.8,
        step: 0.01,
        description: "Useful when commas feel too small compared to letters.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "commaShift",
        label: "Comma drop",
        min: -12,
        max: 18,
        step: 1,
        description: "Moves commas lower or higher relative to the baseline.",
      },
      {
        key: "dotScale",
        label: "Dot size",
        min: 0.5,
        max: 1.8,
        step: 0.01,
        description: "Scale for periods and dot-like punctuation.",
        format: (value) => `${value.toFixed(2)}x`,
      },
    ],
  },
  {
    title: "Layout",
    description:
      "Overall size, margins, baseline wobble, and line drift.",
    controls: [
      {
        key: "overallScale",
        label: "Overall size",
        min: 0.8,
        max: 2.2,
        step: 0.01,
        description: "Scales the whole handwriting system up or down.",
        format: (value) => `${value.toFixed(2)}x`,
      },
      {
        key: "marginLeft",
        label: "Left margin",
        min: 20,
        max: 220,
        step: 1,
        description: "Page start position from the left edge.",
      },
      {
        key: "marginTop",
        label: "Top margin",
        min: 40,
        max: 300,
        step: 1,
        description: "Baseline position of the first line.",
      },
      {
        key: "marginRight",
        label: "Right margin",
        min: 10,
        max: 180,
        step: 1,
        description: "Padding kept before the page edge.",
      },
      {
        key: "marginBottom",
        label: "Bottom margin",
        min: 40,
        max: 260,
        step: 1,
        description: "Padding kept before the bottom of the page.",
      },
      {
        key: "baselineJitter",
        label: "Baseline wobble",
        min: 0,
        max: 5,
        step: 0.05,
        description: "Tiny up and down movement of individual glyphs.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "lineDriftPerWord",
        label: "Line drift",
        min: 0,
        max: 3,
        step: 0.05,
        description: "Gentle rising or dipping motion across each line.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "wordSpacingJitter",
        label: "Word spacing variance",
        min: 0,
        max: 20,
        step: 0.25,
        description: "How much each word gap can vary from the slider above.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "rotation",
        label: "Rotation range",
        min: 0,
        max: 8,
        step: 0.1,
        description: "Maximum rotation in degrees in either direction.",
        format: (value) => `${value.toFixed(1)} deg`,
      },  {
    key: "jitter",
    label: "Wobble",
    min: 0,
    max: 12,
    step: 0.5,
    description: "Natural wobble for spacing, drift, and rotation.",
    format: (value) => value.toFixed(1),
  },
    ],
  },
  {
    title: "Ink & Texture",
    description:
      "Darkness, rough edges, and paper blending.",
    controls: [
      {
        key: "pressureMin",
        label: "Ink pressure (min)",
        min: 0.4,
        max: 1.2,
        step: 0.01,
        description: "Lower bound for ink pressure.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "pressureMax",
        label: "Ink pressure (max)",
        min: 0.5,
        max: 1.5,
        step: 0.01,
        description: "Upper bound for ink pressure.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "strokeGain",
        label: "Stroke thickness",
        min: 0.6,
        max: 2.4,
        step: 0.01,
        description: "Makes the handwriting look lighter or thicker.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "edgeRoughness",
        label: "Edge roughness",
        min: 0,
        max: 0.3,
        step: 0.01,
        description: "Adds slight edge breakup so strokes look less perfect.",
        format: (value) => value.toFixed(2),
      },
      {
        key: "textureBlend",
        label: "Paper blend",
        min: 0,
        max: 0.4,
        step: 0.01,
        description: "Blends ink more into the page texture.",
        format: (value) => value.toFixed(2),
      },
    ],
  },
];

export const CHARACTER_OVERRIDE_CONTROLS: CharacterSliderConfig[] = [
  {
    key: "scaleMultiplier",
    label: "Size / height",
    min: 0.4,
    max: 2.2,
    step: 0.01,
    description: "Scales only this exact character.",
    format: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "widthMultiplier",
    label: "Width / advance",
    min: 0.4,
    max: 2.0,
    step: 0.01,
    description: "Makes this character occupy less or more width.",
    format: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "baselineShift",
    label: "Move up / down",
    min: -32,
    max: 32,
    step: 1,
    description: "Negative moves up. Positive moves down.",
  },
  {
    key: "strokeGainMultiplier",
    label: "Line thickness",
    min: 0.5,
    max: 2.5,
    step: 0.01,
    description: "Changes stroke weight for only this character.",
    format: (value) => `${value.toFixed(2)}x`,
  },
  {
    key: "spacingBeforeDelta",
    label: "Space before",
    min: -20,
    max: 20,
    step: 1,
    description: "Shifts this character relative to the previous one.",
  },
  {
    key: "spacingDelta",
    label: "Space after",
    min: -20,
    max: 20,
    step: 1,
    description: "Adds or removes space after this character.",
  },
];

export function normalizeRenderOptions(
  options?: Partial<RenderOptions> | null
): RenderOptions {
  return {
    ...FALLBACK_OPTIONS,
    ...options,
    charOverrides: options?.charOverrides ?? {},
  };
}

export function formatControlValue(config: SliderConfig, value: number) {
  if (config.format) {
    return config.format(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatCharacterControlValue(
  config: CharacterSliderConfig,
  value: number
) {
  if (config.format) {
    return config.format(value);
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
