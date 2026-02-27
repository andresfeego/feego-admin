# Design System Feego System (DSFS)

## Activation / Scope
Apply this skill automatically whenever the user requests:
- UI components
- Screens
- Layouts
- Dashboards
- Forms
- Modals
- Landing pages
- Visual interface design (web or mobile)

This skill is mandatory for all UI output in those scenarios.

## Non-Negotiable Spacing Rules
All spacing must follow an **8pt grid**.

Allowed spacing values:
- `0, 8, 16, 24, 32, 40, 48, 64`
- `96` and `128` only for large sections when justified

Forbidden arbitrary values:
- `10px, 14px, 18px, 22px, 30px`

Apply these spacing rules to:
- `margin`
- `padding`
- `gap`
- `grid spacing`
- `container padding`

## Spacing Design Tokens
Use named spacing tokens only.

### CSS Variables
```css
:root {
  --space-0: 0px;
  --space-1: 8px;
  --space-2: 16px;
  --space-3: 24px;
  --space-4: 32px;
  --space-5: 40px;
  --space-6: 48px;
  --space-7: 64px;
  --space-8: 96px;
  --space-9: 128px;
}
```

### JS/TS Tokens
```ts
export const spacing = {
  0: 0,
  1: 8,
  2: 16,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
  7: 64,
  8: 96,
  9: 128,
};
```

## Responsive Density Map
Larger screens require more breathing space.

| Breakpoint | Container Padding | Gaps | Section Spacing |
|---|---:|---:|---:|
| Mobile (`<640px`) | `16` | `16` | `24–32` |
| Tablet (`≥768px`) | `24` | `24` | `32–48` |
| Desktop (`≥1024px`) | `32` | `32` | `48–64` |
| Large (`≥1440px`) | `48` | `40–48` | `64–96` |

## Usage Heuristics
- Label + input: `8px`
- Between form fields: `16px`
- Inside card blocks: `16px`
- Between cards: `16–24px`
- Between main sections: `32–64px`
- Modal padding: `24` (mobile) / `32` (desktop)

## Typography System (Aligned with 8pt Rhythm)
Allowed font sizes (`px`):
- `12, 14, 16, 20, 24, 32, 40, 48`

Preferred line-heights (`px`):
- `16, 20, 24, 32, 40, 48, 56, 64`

Allowed font weights:
- `400, 500, 600, 700`

Forbidden:
- `13px, 15px, 17px`
- `font-weight: 300`
- `font-weight: 800+` unless explicitly requested

### CSS Typography Tokens
```css
:root {
  --font-size-12: 12px;
  --font-size-14: 14px;
  --font-size-16: 16px;
  --font-size-20: 20px;
  --font-size-24: 24px;
  --font-size-32: 32px;
  --font-size-40: 40px;
  --font-size-48: 48px;

  --line-height-16: 16px;
  --line-height-20: 20px;
  --line-height-24: 24px;
  --line-height-32: 32px;
  --line-height-40: 40px;
  --line-height-48: 48px;
  --line-height-56: 56px;
  --line-height-64: 64px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### Semantic Usage
- Body: `16/24`, weight `400`
- Caption: `12/16`, weight `400`
- Labels: `14/20`, weight `500`
- Card title: `20/32`, weight `600`
- Page title: `32/40`, weight `700`
- Hero title: `40–48`, weight `700`

## Motion System (Basic CSS Animations)
Principle: motion must improve clarity, not decoration.

Allowed durations:
- `150ms, 200ms, 250ms, 300ms`

Recommended easing:
- `ease-out`
- `cubic-bezier(0.4, 0, 0.2, 1)`

Rules:
- No animations longer than `300ms`
- No infinite animations in critical UI
- Respect `prefers-reduced-motion`

### Button Hover (subtle lift + shadow)
```css
.btn {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}
```

### Modal Enter (fade + scale)
```css
@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

.modal-enter {
  animation: modal-enter 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Modal Exit (fade out)
```css
@keyframes modal-exit {
  from { opacity: 1; }
  to { opacity: 0; }
}

.modal-exit {
  animation: modal-exit 150ms ease-out;
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0ms !important;
    transition-duration: 0ms !important;
  }
}
```

## Final Validation Checklist
Before delivering any UI, verify:

### Spacing
- All spacing values are multiples of 8
- Container spacing follows breakpoint rules

### Typography
- Only allowed font sizes are used
- Only allowed font weights are used
- Line-height is consistent with the system

### Motion
- Duration is within allowed values
- Motion is functional, not decorative
- `prefers-reduced-motion` is respected
