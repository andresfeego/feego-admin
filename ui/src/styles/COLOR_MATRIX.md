# Color Matrix

Single source of truth for UI colors lives in:
- `src/styles/tokens.scss`

## Brand Tokens
- `$primary-500` -> base blue
- `$primary-600` -> strong blue
- `$secondary-600` -> secondary purple-blue
- `$accent-500` -> accent green
- `$danger-500` -> base red
- `$danger-600` -> strong red

## Semantic Tokens (use these in components)
- `--color-primary`
- `--color-primary-strong`
- `--color-secondary`
- `--color-accent`
- `--color-danger`
- `--color-danger-strong`

## Surface Tokens
- `--surface-page`
- `--surface-page-gradient`
- `--surface-card`
- `--surface-card-solid`
- `--surface-overlay`
- `--surface-overlay-soft`
- `--surface-overlay-mid`
- `--surface-overlay-strong`
- `--surface-overlay-stronger`

## Text Tokens
- `--text-main`
- `--text-muted-1`
- `--text-muted-2`
- `--text-muted-3`

## Border/State Tokens
- `--border-soft`
- `--border-softer`
- `--primary-surface`
- `--primary-surface-hover`
- `--primary-border`
- `--danger-surface`
- `--danger-surface-hover`
- `--danger-border`
- `--active-bg`
- `--active-border`
- `--focus-ring`
- `--focus-border`
- `--hover-soft`
- `--hover-subtle`

## Overlay/Modal Tokens
- `--overlay-backdrop`
- `--modal-bg`
- `--modal-border`

## Rule
- Do not add per-component literal hex/rgb colors.
- Add/update tokens in `tokens.scss` and consume the token in CSS/SCSS/Tailwind classes.
- If two colors look very similar, unify to one semantic token.
