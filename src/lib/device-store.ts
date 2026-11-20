// Small things curadiário keeps in this browser's localStorage. Keys live in IndexedDB
// (src/lib/device-keys.ts), never here. No component touches localStorage directly.
//
// Browser only. Do not import from Server Components.

import {isThemeChoice, THEME_STORAGE_KEY, type ThemeChoice} from './theme';

const EMAIL_KEY = 'curadiario:email';

/** The e-mail typed on the sign-in screen, to finish with the 6-digit code. */
export function readPendingEmail(): string {
  try {
    return window.localStorage.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writePendingEmail(email: string) {
  try {
    if (email) window.localStorage.setItem(EMAIL_KEY, email);
    else window.localStorage.removeItem(EMAIL_KEY);
  } catch {
    // Nothing to do: the person types it again.
  }
}

// ---------------------------------------------------------------------------
// Theme choice (src/lib/theme.ts). Its own key, read before the first paint by the inline script.
// ---------------------------------------------------------------------------

export function readThemeChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** "auto" removes the key: the device decides again. */
export function writeThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: this browser can't keep the choice, so the device setting stays in charge.
  }
}
