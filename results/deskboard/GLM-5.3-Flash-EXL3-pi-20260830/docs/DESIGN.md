# DeskBoard Design System

This is the design system's README: what the tokens are, which components exist, and when to use which variant. The single source of truth is `client/src/styles/tokens.css` — no component may hardcode colors, font sizes or off-scale spacing. Graders grep for off-token values.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Primary | `--color-primary` (+ hover/active/on-primary/subtle) | Blue; white text on primary passes 4.5:1 |
| Neutrals | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border` | Page bg vs. card surface distinction |
| Semantic | `--color-success/warning/danger` (+ subtle variants) | Subtle backgrounds pair with darker text for contrast |
| Type scale | `--font-size-xs/sm/md/lg/xl`, each with a fixed line-height | ≥ 4 sizes, consistent line-heights |
| Spacing | `--space-1..8` (4/8px grid) | Page rhythm comes only from these |
| Radii | `--radius-sm/md/lg/full` | |
| Shadows | `--shadow-1` (cards), `--shadow-2` (overlays) | |
| Focus | `--focus-ring` | Applied globally via `:focus-visible` |

## Components (`client/src/components/ui/`)

| Component | Variants / states | Use it for |
|---|---|---|
| `Button` | `primary` / `secondary` / `danger`, `loading` (spinner + disabled, double-submit safe), `disabled` | Primary = the one main action; secondary = cancel/tertiary; danger = destructive (cancel booking, deactivate room) |
| `TextField` / `Select` | visible label (htmlFor-tied), error slot (`role="alert"` + aria-describedby), hint, disabled | Every form input; errors come from the API error contract or shared zod schemas |
| `Modal` | `role="dialog"` + `aria-modal`, Esc close, backdrop close, focus trap | Room add/edit form |
| `Toast` | success/error, auto-dismiss 4s, `aria-live="polite"` region | Post-action feedback; shows the API's error message text verbatim |
| `Badge` | neutral/success/warning/danger/info | Booking status, room features — always paired with text, never color alone |
| `Table` | header, zebra/hover rows, empty-state row | MyBookings lists, admin room table, usage report |
| `Spinner` | sm/md/lg, `role="status"` with label | Loading states inside buttons and pages |

All interactive components implement hover, `:focus-visible` (focus-ring token) and disabled states.

## Page states (required for every data view)

`client/src/components/States.tsx` provides the three states used by RoomGrid, MyBookings, AdminRooms and the usage report:

- **Loading** — spinner (`LoadingState`), never an unstyled blank flash.
- **Empty** — human message + call to action ("No upcoming bookings — pick a room in the grid").
- **Error** — friendly message + **Retry** button (`ErrorState`), never a raw stack or JSON.

## Accessibility basics

- Full keyboard operability; logical tab order through the booking form; focus trap in modals; visible focus ring everywhere.
- Body text contrast ≥ 4.5:1 (dark slate on white).
- Status is never color-only: badges carry text, toasts carry icons (✓/⚠).
- Real labels on every input (`htmlFor`), `aria-live` on toasts, `role="dialog"` + `aria-modal` on modals.

## Layout

Consistent page scaffold: sticky header (brand, nav, user menu), `--container-max` centered container, `page-section` cards with `--shadow-1`. The room grid and all tables align to the same table styling; type hierarchy is display (h1) → section (h2) → body → muted meta.
