export type UploadType = "alphabet" | "coding";

/** Simple = alphabet datasets only in UI. Coding = alphabet + coding datasets. */
export type AssignmentMode = "simple" | "coding";

export type RenderOptions = {
  lineHeight: number;
  charSpacing: number;
  wordSpacing: number;
  jitter: number;
  inkColor: string;
  overallScale: number;
  marginLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  baselineJitter: number;
  lineDriftPerWord: number;
  wordSpacingJitter: number;
  rotation: number;
  pressureMin: number;
  pressureMax: number;
  strokeGain: number;
  edgeRoughness: number;
  textureBlend: number;
  upperScale: number;
  ascenderScale: number;
  xHeightScale: number;
  descenderScale: number;
  descenderShift: number;
  digitScale: number;
  symbolScale: number;
  commaScale: number;
  commaShift: number;
  dotScale: number;
  charOverrides: Record<string, CharacterOverride>;
};

export type CharacterOverride = {
  scaleMultiplier: number;
  widthMultiplier: number;
  baselineShift: number;
  strokeGainMultiplier: number;
  spacingBeforeDelta: number;
  spacingDelta: number;
};

export type UploadCounts = {
  handwriting: number;
  coding: number;
};

export type DatasetResponse = {
  handwriting?: string[];
  coding?: string[];
};

export type DefaultsResponse = {
  options?: RenderOptions;
  features?: {
    charOverrides?: boolean;
  };
};

export type ExtractResponse = {
  sessionId?: string;
  datasets?: DatasetResponse;
  error?: string;
  details?: string;
};

export type NumericOptionKey = Exclude<
  keyof RenderOptions,
  "inkColor" | "charOverrides"
>;

export type CharacterOverrideKey = keyof CharacterOverride;

export type SliderConfig = {
  key: NumericOptionKey;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
  format?: (value: number) => string;
};

export type ControlGroup = {
  title: string;
  description: string;
  controls: SliderConfig[];
};

export type CharacterSliderConfig = {
  key: CharacterOverrideKey;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
  format?: (value: number) => string;
};
