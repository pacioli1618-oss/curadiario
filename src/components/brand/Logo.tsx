// curadiário mark: a lantern with a lit flame — someone keeping watch through the night.
// Same geometry as app/icon.svg, the PWA icons in public/icons/ and docs/brand/.
// The wordmark is live text in the display font, so it stays crisp and is read by screen readers.

const FLAME = 'M1 -22 C3 -15 10 -11 10 -1 A10 10 0 0 1 -10 -1 C-10 -7 -7 -11 -4 -14 C-4 -10 -2 -8 0 -8 C-1 -13 -2 -18 1 -22 Z';

export function LogoSymbol({size = 28}: {size?: number}) {
  return (
    <svg width={size} height={size} viewBox="14 10 72 76" aria-hidden="true" style={{flex: 'none'}}>
      <path d="M43 21 A7 7 0 0 1 57 21" fill="none" stroke="var(--logo-frame)" strokeWidth="5" strokeLinecap="round" />
      <path d="M35 30 H65 L60 23 H40 Z" fill="var(--logo-frame)" stroke="var(--logo-frame)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="33" y="31" width="34" height="42" rx="6" fill="none" stroke="var(--logo-frame)" strokeWidth="6" />
      <path d="M29 79 H71" stroke="var(--logo-frame)" strokeWidth="7" strokeLinecap="round" />
      <path transform="translate(50 64) scale(1.15)" d={FLAME} fill="var(--logo-flame)" />
    </svg>
  );
}

/** Horizontal logo: lantern + "cura" in ink and "diário" in teal (Sidekick series wordmark). */
export function Logo() {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
      <LogoSymbol />
      <span style={{fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em'}}>
        cura<span style={{color: 'var(--brand)'}}>diário</span>
      </span>
    </span>
  );
}
