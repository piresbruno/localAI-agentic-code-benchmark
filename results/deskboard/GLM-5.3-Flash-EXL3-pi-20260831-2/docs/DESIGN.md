# DeskBoard Design System

The design system is plain CSS on top of a single token file. No component libraries.

## Tokens — `client/src/styles/tokens.css`

The **single source** for every visual value. Components never hardcode hex colors,
font sizes, or off-scale spacing.

| Group      | Tokens                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Brand      | `--color-primary` (#1d4ed8, 4.5:1+ on white), `--color-primary-hover`, `--color-primary-contrast`                        |
| Neutrals   | `--color-surface`, `--color-background`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-strong` |
| Semantic   | success/warning/danger in text + background pairs (`--color-danger`, `--color-danger-bg`, …)                             |
| Type scale | `--font-size-xs/sm/md/lg/xl` (12–28px) with `--line-height-tight/snug/normal`                                            |
| Spacing    | `--space-1…8` on a 4/8px grid (4, 8, 12, 16, 24, 32, 48, 64)                                                             |
| Radii      | `--radius-sm/md/lg/full`                                                                                                 |
| Elevation  | `--shadow-1/2/3`                                                                                                         |
| Focus      | `--focus-ring` (3px primary ring, used by every interactive element)                                                     |
| Layout     | `--container-max` (1100px)                                                                                               |

## Components — `client/src/components/ui/`

| Component   | Variants / states                                                                                                                                                                                   | Use it for                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Button`    | `primary` (one per view, the main action), `secondary` (navigation/cancel), `danger` (destructive: cancel booking, deactivate room); `loading` (spinner + disabled, double-submit safe), `disabled` | Every action                                                 |
| `TextField` | visible label tied via `htmlFor`, `error` slot (`role="alert"`, `aria-describedby`, `aria-invalid`), `disabled`, `hint`                                                                             | Text/email/password/date/number input                        |
| `Select`    | same label/error/disabled/hint contract as TextField                                                                                                                                                | Room, start time, duration                                   |
| `Modal`     | `role="dialog"` + `aria-modal`, focus trap (Tab wraps), Esc + backdrop close, focus restored on close                                                                                               | Admin add/edit room                                          |
| `Toast`     | success/error (icon + text, never color alone), auto-dismiss 4s, single `aria-live="polite"` region                                                                                                 | Feedback after mutations; shows the API's error message text |
| `Table`     | header row, hover rows, empty-state row (`count` + `emptyMessage`)                                                                                                                                  | MyBookings, AdminRooms, availability grid                    |
| `Spinner`   | `role="status"` + label                                                                                                                                                                             | Loading states, inline in `Button`                           |

Every component implements hover, `focus-visible` (token ring), and disabled states.

## UX states (spec §7.3)

`pages/DataView.tsx` is the shared scaffold: **loading** (spinner + `aria-busy`),
**error** (friendly message + "Try again", never raw JSON), **empty** (human message +
call to action). RoomGrid, MyBookings and AdminRooms all render through it.

## Interaction rules

- Submit buttons disable + show spinner while in flight (double-submit safe).
- Feedback via toast: success in green with ✓, failure in red with ⚠ and the API's
  error message (e.g. `ROOM_CONFLICT` text).
- Destructive actions (`Cancel`, `Deactivate`) use the danger variant; disabled
  cancellations carry a `title` tooltip explaining the cancellation window.

## Accessibility (WCAG AA basics)

- Full keyboard operability: nav, grid slot buttons, forms, modal trap.
- Visible focus ring on every interactive element (`.link`, `.slot-button`, `.btn`, …).
- Body text contrast ≥ 4.5:1 (`--color-text` on surface, `--color-text-muted` 5.4:1).
- Status never by color alone: badges pair icons (● / ⊘ / ✓) with text labels.
- Real labels on all inputs; `aria-invalid`/`aria-describedby` on errors;
  `role="dialog"` + `aria-modal` on modals; `aria-live` on toasts and loading regions.

## Layout

One page scaffold: sticky-ish header (brand + nav + user menu), 1100px container,
section rhythm from the spacing scale. The availability grid scrolls horizontally
below ~700px so all 11 slots stay usable at 360px width.
