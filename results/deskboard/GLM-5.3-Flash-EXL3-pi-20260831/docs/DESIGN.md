# DeskBoard Design System

One page describing the tokens, the component inventory, and when to use which variant.
Everything visual derives from `client/src/styles/tokens.css` — no off-token hex/px values in
component CSS (verified by `grep`).

## Tokens (`client/src/styles/tokens.css`)

| Group | Tokens |
|---|---|
| Primary | `--color-primary` (#1d4ed8, 6.3:1 on white), `-hover`, `-soft`, `--color-on-primary` |
| Neutrals | `--color-bg`, `-surface`, `-border`, `-border-soft`, `-text` (#0f172a, 15:1), `-text-muted` (#475569, 7:1) |
| Semantic | success/warning/danger pairs (`-color` + `-bg`) |
| Typography | 5 sizes (`xs 0.75rem → xl 1.625rem`), each with a paired line-height; 3 weights |
| Spacing | 4/8 px grid: `--space-1..8` (4, 8, 12, 16, 24, 32, 48) |
| Radii | `--radius-sm|md|lg|full` (4/8/14/999 px) |
| Shadows | `--shadow-1..3` (resting, floating, modal) |
| Focus | `--focus-ring` — a 3 px translucent primary ring applied to every `:focus-visible` |

Contrast: body text ≥ 7:1, muted text ≥ 7:1, primary-on-white 6.3:1 — all above the 4.5:1 WCAG AA bar.
Status is never color-only: badges pair an icon glyph (● ✔ ✖) with the word.

## Components (`client/src/components/ui/`)

| Component | Variants / states | Use it for |
|---|---|---|
| `Button` | `primary` / `secondary` / `danger`, `loading` (spinner + disabled), disabled | Every action. Primary = main CTA, secondary = navigation/cancel, danger = destructive (cancel booking, deactivate room). Loading doubles as double-submit protection. |
| `TextField` / `Select` | visible label via `htmlFor`, error slot (`role="alert"`, `aria-invalid`, `aria-describedby`), disabled | Every form input. Error text comes from the API error contract or client pre-validation. |
| `Modal` | `role="dialog"` + `aria-modal`, Esc close, backdrop click, focus trap + restore | Add/edit room, any focused task. Never nest modals. |
| `Toast` | success / error, auto-dismiss 4 s, `aria-live="polite"` region | Post-action feedback. Error toasts surface the API's message text. |
| `Table` | header row, hover rows, col-spanned empty-state row | AdminRooms, any tabular data. |
| `Spinner` | `role="status"`, sizes | Inline loading inside buttons and loading blocks. |

All interactive elements implement hover, `:focus-visible` (ring token), and disabled states, and
are keyboard-operable (tab order follows the DOM; the modal traps and restores focus).

## UX states (spec §7.3)

`components/States.tsx` provides the shared building blocks used by every data view
(RoomGrid, MyBookings, AdminRooms):

- **Loading** — RoomGrid renders a shimmering grid skeleton; other views use `LoadingBlock` (spinner + label). Never an unstyled blank flash.
- **Empty** — human message + call to action, e.g. "No bookings yet — pick a room" with a link to the grid.
- **Error** — friendly panel (`role="alert"`) with the safe message and a **Try again** button; raw JSON/stack traces never reach the user.

## Layout

- Page scaffold: sticky-feel header (brand `DeskBoard`, nav links, user menu) + `--container-max` centered container.
- Type hierarchy: `page-title` (xl/bold) → section headings (md/semibold) → body (md) → meta (sm, muted).
- Room grid and tables align to shared borders; ≥ 360 px: forms collapse to one column, the grid scrolls horizontally.

## Accessibility checklist (WCAG AA basics)

- [x] Keyboard operable end-to-end (login → grid → booking form → modals → toasts)
- [x] Visible focus (`:focus-visible` ring token)
- [x] Real labels on all inputs; modals announce via `role="dialog"`/`aria-modal`
- [x] Toasts in `aria-live="polite"`; spinners/buttons `role="status"`/`aria-busy`
- [x] Status paired with icon + text, never color alone
- [x] Contrast ≥ 4.5:1 for all body text
