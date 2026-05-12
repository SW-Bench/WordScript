export const HOTKEY_MODIFIER_KEYS = new Set(["ctrl_l", "alt_l", "shift_l", "win", "cmd"]);
export const HOTKEY_SEPARATOR_HINT = "Manual format: use + between keys, for example ctrl_l+f9. Legacy commas are also accepted and converted.";

export function splitHotkeyParts(value: string): string[] {
  return value
    .split(/[+,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeHotkeyToken(value: string): string {
  const lower = value.trim().toLowerCase();

  switch (lower) {
    case "ctrl":
    case "control":
    case "ctrl_l":
    case "ctrl_r":
      return "ctrl_l";
    case "alt":
    case "alt_l":
    case "alt_r":
    case "option":
      return "alt_l";
    case "shift":
    case "shift_l":
    case "shift_r":
      return "shift_l";
    case "win":
    case "super":
    case "meta":
      return "win";
    case "cmd":
    case "command":
      return "cmd";
    case "esc":
    case "escape":
      return "escape";
    case "enter":
    case "return":
      return "enter";
    case "tab":
      return "tab";
    case "backspace":
      return "backspace";
    case "space":
      return "space";
    default:
      return lower;
  }
}

export function normalizeManualHotkey(value: string): string {
  return splitHotkeyParts(value).map(normalizeHotkeyToken).join("+");
}

export function getHotkeyValidationMessage(value: string, options?: { allowModifierOnly?: boolean }): string | null {
  const normalized = normalizeManualHotkey(value);
  if (!normalized) {
    return "Shortcut is required.";
  }

  const parts = splitHotkeyParts(normalized);
  if (!options?.allowModifierOnly && parts.every((part) => HOTKEY_MODIFIER_KEYS.has(part))) {
    return "Shortcut must include at least one non-modifier key.";
  }

  return null;
}