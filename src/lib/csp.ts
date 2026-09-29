/**
 * Inline `<style>` blocks the content security policy allows by hash.
 *
 * sonner (the toast library) injects its stylesheet at runtime: it appends an
 * empty `<style>` element and then fills it. The policy only trusts styles with
 * the per-request nonce, so without these hashes both steps are blocked and
 * toasts lose `position: fixed`, rendering unstyled below the footer where
 * nobody sees them. `src/lib/__tests__/csp.test.ts` recomputes the hashes from
 * the installed package, so a sonner upgrade that changes its CSS fails CI and
 * prints the new value.
 */
export const INLINE_STYLE_HASHES = [
  // The empty <style> element sonner creates before adding its CSS.
  "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
  // sonner 2.0.7's stylesheet.
  "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='",
] as const;
