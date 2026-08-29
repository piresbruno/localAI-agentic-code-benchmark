# DeskBoard — Design System

The design system makes every screen consistent without a component library. Plain CSS, built entirely on design tokens.

## Tokens (`client/src/styles/tokens.css`)

`tokens.css` is the **single source** for visual values. Hardcoded hex colors, font sizes, or off-scale spacing elsewhere in `client/src` are defects.

| Group | Tokens |
|---|---|
| Brand color | `--color-primary` (+ `strong`/`soft`/`contrast`) |
| Neutrals | `--color-bg`, `--color-surface`, `--color-border` (+`strong`), `--color-text` (+`muted`) |
| Semantic | `--color-success`, `--color-warning`, `--color-danger` (+`soft` variants) |
| Type scale | `--text-xs/sm/md/lg/xl` with `--leading-tight/normal` |
| Spacing | `--space-1…7` on a 4/8px grid (4, 8, 12, 16, 24, 32, 48) |
| Radii | `--radius-sm/md/lg/full` |
| Shadows | `--shadow-1/2/3` (card → modal elevation) |
| Focus | `--focus-ring` (visible keyboard focus everywhere) |

## Components (`client/src/components/ui/`)

| Component | Variants / states |
|---|---|
| `Button` | `primary` / `secondary` / `danger`; `loading` (spinner + disabled, double-submit safe); `disabled` |
| `TextField`, `Select` | visible `<label htmlFor>` binding, error slot (`role=alert`, `aria-invalid`, `aria-describedby`), disabled |
| `Modal` | `role=dialog` + `aria-modal`, focus trap, Esc closes, backdrop click closes, focus restored on close |
| `Toast` (provider + `useToast`) | success/error styles, auto-dismiss 4s, `aria-live="polite"` region |
| `StatusBadge`, `FeatureTag` | status never color alone — text marker included (✓/✕/•) |
| `Table` | header, zebra + hover rows, empty-state row |
| `Spinner`, `Skeleton`, `SkeletonRows` | loading states for buttons and data views |

All interactive components implement hover, `focus-visible` (token ring), and disabled states.

## UX states — the triad

Every data view (RoomGrid, MyBookings, AdminRooms, usage report) implements:

1. **Loading** — `SkeletonRows`/`Spinner`, never a blank flash.
2. **Empty** — human message + call to action ("No upcoming bookings — pick a room in the grid").
3. **Error** — friendly message + **Retry** button; raw JSON/stack traces never surface.

Interaction feedback: submit buttons show pending state and are disabled while in flight; success/failure feedback via toasts, including the API's own error message text.

## Accessibility (WCAG AA basics)

- Keyboard operable throughout; logical tab order; focus ring token; modals trap focus and restore it on close.
- Body text contrast ≥ 4.5:1 (`--color-text` #1a202c on #f6f7f9 ≈ 14:1).
- Status never by color alone (badge text markers, button titles/aria-labels for disabled cancel reasons).
- Real labels on all inputs; `role=dialog`/`aria-modal` on modals; `aria-live` toasts.

## Layout

Consistent scaffold: header (brand + nav + user menu), `--container-max` content width, section rhythm from the spacing scale. The room grid and tables align to it. Responsive below 640px (nav wraps, form rows stack). Type hierarchy: `page-title` (xl) → `section-title` (lg) → body (md/sm).
