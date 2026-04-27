export type UploadType = "alphabet" | "coding";
export type JobStatus = "queued" | "processing" | "completed" | "failed";

/** Simple = alphabet datasets only in UI. Coding = alphabet + coding datasets. Font-Export = specialized font generator. */
export type AssignmentMode = "simple" | "coding" | "font-export";


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
  lineStartJitter: number;
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
  heightMultiplier: number;
  widthMultiplier: number;
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
  handwritingLimit: number;
  codingLimit: number;
};

export type DatasetRecord = {
  id: string;
  user_id: string;
  dataset_type: UploadType;
  display_name: string;
  source_image_path: string;
  glyph_root: string;
  status: JobStatus;
  created_at: string;
  updated_at?: string | null;
  error_message?: string | null;
};

export type DatasetListResponse = {
  items: DatasetRecord[];
  alphabet_count: number;
  coding_count: number;
  alphabet_limit: number;
  coding_limit: number;
};

export type BackgroundRecord = {
  id: string;
  user_id: string;
  display_name: string;
  source_image_path: string;
  status: JobStatus;
  is_default: boolean;
  is_selected: boolean;
  created_at: string;
  updated_at?: string | null;
  error_message?: string | null;
};

export type BackgroundListResponse = {
  items: BackgroundRecord[];
  custom_count: number;
  background_limit: number;
};

export type DefaultsResponse = {
  options: Partial<RenderOptions>;
  features?: {
    charOverrides?: boolean;
  };
  fonts?: string[];
};

export type UserProfile = {
  id: string;
  email: string;
  auth_mode: string;
  created_at: string;
};

export type AuthProviderMode = "local" | "supabase";

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  provider: AuthProviderMode;
  user: UserProfile;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: UserProfile;
};

export type ApiError = {
  detail?: string;
  error?: string;
  details?: string;
};

export type RenderJobResponse = {
  id: string;
  user_id: string;
  text_content: string;
  options_json: string;
  output_path: string;
  status: JobStatus;
  created_at: string;
  updated_at?: string | null;
  error_message?: string | null;
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
