import { KeyLayout } from "./keyboard_profile";

/** Compute plausible row×column layouts for a given button count. */
export function computeLayouts(buttons: number): KeyLayout[] {
  if (buttons === 0) {
    return [{ rows: 0, columns: 0 }];
  }
  if (buttons === 1) {
    return [{ rows: 1, columns: 1 }];
  }
  const layouts: KeyLayout[] = [{ rows: 1, columns: buttons }];
  for (const factor of [2, 3, 4, 5, 6, 7]) {
    if (factor >= buttons) {
      break;
    }
    const complement = buttons / factor;
    if (Number.isInteger(complement)) {
      layouts.push({ rows: factor, columns: complement });
    }
  }
  layouts.push({ rows: buttons, columns: 1 });
  return layouts;
}
