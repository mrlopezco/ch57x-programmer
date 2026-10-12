import { Modifier } from "./keyboard";

/** Platform-aware display labels for HID modifiers. */
export function modifierLabel(modifier: Modifier): string {
  const isApple =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  switch (modifier) {
    case "Ctrl":
      return "Ctrl";
    case "RightCtrl":
      return "RCtrl";
    case "Shift":
      return "Shift";
    case "RightShift":
      return "RShift";
    case "Alt":
      return isApple ? "Opt" : "Alt";
    case "RightAlt":
      return isApple ? "ROpt" : "RAlt";
    case "Meta":
      return isApple ? "Cmd" : "Win";
    case "RightMeta":
      return isApple ? "RCmd" : "RWin";
  }
}

export function formatKeyChordSummary(
  modifiers: Modifier[],
  code: string | number | undefined
): string {
  const parts = modifiers.map(modifierLabel);
  if (code !== undefined) {
    parts.push(typeof code === "number" ? `0x${code.toString(16)}` : code);
  }
  return parts.length === 0 ? "(empty)" : parts.join(" + ");
}
