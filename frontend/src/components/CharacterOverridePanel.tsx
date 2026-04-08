import { useMemo, useState } from "react";
import {
  CHARACTER_OVERRIDE_CONTROLS,
  EMPTY_CHARACTER_OVERRIDE,
  formatCharacterControlValue,
} from "../renderControls";
import type {
  CharacterOverride,
  CharacterOverrideKey,
} from "../types";

type Props = {
  text: string;
  charOverrides: Record<string, CharacterOverride>;
  isSupported: boolean;
  onChange: (
    char: string,
    key: CharacterOverrideKey,
    value: number
  ) => void;
  onReset: (char: string) => void;
  onResetField: (char: string, key: CharacterOverrideKey) => void;
};

const CHARACTER_NAMES: Record<string, string> = {
  " ": "Space",
  "\t": "Tab",
  "!": "Exclamation",
  "@": "At",
  "#": "Hash",
  "%": "Percent",
  "^": "Caret",
  "&": "Ampersand",
  "*": "Asterisk",
  "(": "Left parenthesis",
  ")": "Right parenthesis",
  "_": "Underscore",
  "-": "Dash",
  "=": "Equals",
  "+": "Plus",
  "[": "Left bracket",
  "]": "Right bracket",
  "{": "Left brace",
  "}": "Right brace",
  ";": "Semicolon",
  ":": "Colon",
  "'": "Apostrophe",
  "\"": "Quote",
  "<": "Less than",
  ">": "Greater than",
  "/": "Slash",
  "?": "Question mark",
  "\\": "Backslash",
  "|": "Pipe",
  "`": "Backtick",
  "~": "Tilde",
  ",": "Comma",
  ".": "Dot",
};

const CHARACTER_ORDER = Array.from(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#%^&*()_-=+[]{};:'\"<>/?\\|`~,."
);
const CHARACTER_ORDER_INDEX = new Map(
  CHARACTER_ORDER.map((char, index) => [char, index])
);

function getUniqueCharacters(text: string) {
  const seen = new Set<string>();
  const chars: string[] = [];

  for (const char of Array.from(text)) {
    if (!char.trim()) {
      continue;
    }
    if (seen.has(char)) {
      continue;
    }
    seen.add(char);
    chars.push(char);
  }

  return chars;
}

function sortCharacters(chars: string[]) {
  return Array.from(new Set(chars)).sort((left, right) => {
    const leftIndex = CHARACTER_ORDER_INDEX.get(left);
    const rightIndex = CHARACTER_ORDER_INDEX.get(right);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) {
      return -1;
    }
    if (rightIndex !== undefined) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

function getCharacterLabel(char: string) {
  const custom = CHARACTER_NAMES[char];
  if (custom) {
    return `${char} (${custom})`;
  }
  return char;
}

function getCharacterKey(char: string, index: number) {
  return `${index}-${char.charCodeAt(0)}`;
}

function getSingleCharacter(value: string) {
  const chars = Array.from(value);
  return chars.length ? chars[chars.length - 1] : "";
}

export function CharacterOverridePanel({
  text,
  charOverrides,
  isSupported,
  onChange,
  onReset,
  onResetField,
}: Props) {
  const [selectedChar, setSelectedChar] = useState("");
  const textCharacters = useMemo(
    () => sortCharacters(getUniqueCharacters(text)),
    [text]
  );
  const overrideCharacters = useMemo(
    () => sortCharacters(Object.keys(charOverrides)),
    [charOverrides]
  );
  const selectableCharacters = useMemo(
    () => sortCharacters([...textCharacters, ...overrideCharacters]),
    [textCharacters, overrideCharacters]
  );

  // Treat an empty selection as "pick the first available character".
  // This avoids calling setState inside an effect.
  const effectiveSelectedChar =
    selectedChar || selectableCharacters[0] || "";

  const currentOverride = effectiveSelectedChar
    ? {
        ...EMPTY_CHARACTER_OVERRIDE,
        ...(charOverrides[effectiveSelectedChar] ?? {}),
      }
    : EMPTY_CHARACTER_OVERRIDE;

  const hasCustomOverride = Boolean(
    effectiveSelectedChar && charOverrides[effectiveSelectedChar]
  );

  return (
    <section className="control-group control-group--character">
      <div className="control-group__header">
        <h3 className="control-group__title">Fix individual characters</h3>
        <p className="control-group__desc">
          When one glyph looks off, tune it without affecting the rest of
          the page.
        </p>
      </div>

      {!isSupported ? (
        <p className="character-compat-warning">
          This feature needs a recent backend build. Restart your server
          and refresh the page.
        </p>
      ) : null}

      <div className="character-picker">
        <label className="character-picker__field">
          <span className="character-picker__label">Character</span>
          <select
            className="character-picker__select"
            value={effectiveSelectedChar}
            disabled={!isSupported}
            onChange={(event) => setSelectedChar(event.target.value)}
          >
            {selectableCharacters.length ? null : (
              <option value="">No characters in compose box yet</option>
            )}
            {selectableCharacters.map((char, index) => (
              <option key={getCharacterKey(char, index)} value={char}>
                {getCharacterLabel(char)}
              </option>
            ))}
          </select>
        </label>

        <label className="character-picker__field character-picker__field--manual">
          <span className="character-picker__label">Type one</span>
          <input
            type="text"
            className="character-picker__input"
            value={effectiveSelectedChar}
            disabled={!isSupported}
            onChange={(event) =>
              setSelectedChar(getSingleCharacter(event.target.value))
            }
            placeholder="f"
            inputMode="text"
          />
        </label>

        <button
          type="button"
          className="btn btn--ghost"
          disabled={!isSupported || !effectiveSelectedChar || !hasCustomOverride}
          onClick={() => {
            if (effectiveSelectedChar) {
              onReset(effectiveSelectedChar);
            }
          }}
        >
          Reset character
        </button>
      </div>

      {textCharacters.length ? (
        <div className="character-chip-list" aria-label="Characters in your text">
          {textCharacters.map((char, index) => (
            <button
              key={getCharacterKey(char, index)}
              type="button"
              className={`character-chip ${
                effectiveSelectedChar === char ? "is-active" : ""
              } ${charOverrides[char] ? "has-override" : ""}`}
              disabled={!isSupported}
              onClick={() => setSelectedChar(char)}
            >
              {char}
            </button>
          ))}
        </div>
      ) : null}

      {effectiveSelectedChar && isSupported ? (
        <div className="controls controls--advanced controls--character">
          {CHARACTER_OVERRIDE_CONTROLS.map((control) => {
            const value = currentOverride[control.key];
            const defaultValue = EMPTY_CHARACTER_OVERRIDE[control.key];
            const valueText = formatCharacterControlValue(control, value);
            const rangeId = `char-override-${effectiveSelectedChar}-${control.key}`;
            const hintId = `${rangeId}-hint`;
            const isDefault = Math.abs(value - defaultValue) <= control.step / 2;

            return (
              <div className="slider-card" key={control.key}>
                <div className="slider-card__header">
                  <label className="slider-card__label" htmlFor={rangeId}>
                    {control.label}
                  </label>
                  <div className="slider-card__actions">
                    <strong className="slider-card__value" aria-hidden>
                      {valueText}
                    </strong>
                    <button
                      type="button"
                      className="btn btn--ghost btn--mini"
                      disabled={isDefault}
                      onClick={() =>
                        onResetField(effectiveSelectedChar, control.key)
                      }
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <input
                  id={rangeId}
                  type="range"
                  className="slider-card__input"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={value}
                  aria-valuemin={control.min}
                  aria-valuemax={control.max}
                  aria-valuenow={value}
                  aria-valuetext={valueText}
                  aria-describedby={hintId}
                  onChange={(event) =>
                    onChange(
                      effectiveSelectedChar,
                      control.key,
                      Number(event.target.value)
                    )
                  }
                />
                <p id={hintId} className="slider-card__hint">
                  {control.description}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="character-picker__empty">
          Type some text in Compose, or pick a character to unlock exact
          tuning.
        </p>
      )}
    </section>
  );
}
