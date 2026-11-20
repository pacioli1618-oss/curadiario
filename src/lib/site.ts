// Who runs curadiário and how to reach them: shown on the About, Privacy and Terms pages.
// Change here (or with the env vars) when the operator, repository or contact changes.

const repositoryUrl = 'https://github.com/pacioli1618-oss/curadiario';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || null;

export const site = {
  operator: 'GR1618',
  repositoryUrl,
  /**
   * Contact goes through comments on the app's launch post on gr1618.io. WordPress holds every
   * comment until the editor approves it, so data requests are read but never published.
   */
  contact: {label: 'gr1618.io/apresentando-o-curadiario', href: 'https://gr1618.io/apresentando-o-curadiario/#respond'},
  /** "curadiario.gr1618.io", for "links start with …"; null when unknown. */
  host: siteUrl ? new URL(siteUrl).host : null,
  /** Address the magic link returns to. Falls back to the current origin. */
  siteUrl,
  /** Date of the current Privacy and Terms text (YYYY-MM-DD). */
  legalUpdatedAt: '2026-11-20',
  /**
   * Version of the terms accepted when creating a diary (diaries.terms_version).
   * Bump it together with legalUpdatedAt when the Terms change.
   */
  termsVersion: '2026-11-20',
} as const;
