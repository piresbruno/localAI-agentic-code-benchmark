# DeskBoard Design System

The design system's README: tokens, components, and when to use which variant.

## Tokens — `client/src/styles/tokens.css`

`tokens.css` is the **single source of truth** for every visual value:

| Group   | Tokens                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color   | `--color-primary`, `--color-surface*`, `--color-border`, `--color-text*`, semantic `--color-success/warning/danger` (+ soft variants for badges/alerts), `--color-focus-ring` |
| Type    | 6 sizes `--font-size-xs…2xl`, each paired with a consistent `--line-height-*`; sans + mono families; weights                                                                  |
| Spacing | `--space-0…8` on a 4/8px grid                                                                                                                                                 |
| Radii   | `--radius-sm/md/lg/full`                                                                                                                                                      |
| Shadows | `--shadow-sm/md/lg`                                                                                                                                                           |
| Motion  | `--duration-fast/med`, `--ease-out`                                                                                                                                           |

**No one-off values**: components reference variables only. Hover/focus/disabled states are defined per component in `ui.css` against the same tokens.

## Components — `client/src/components/ui/`

| Component                                    | Variants / props                                                                                   | Use when                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                     | `primary` (default), `secondary`, `danger`; `size sm/md`; `loading` (spinner + disabled); disabled | Primary for the main action; secondary for side actions (Cancel, Retry); danger for destructive (cancel booking, deactivate room). |
| `TextField`                                  | label (htmlFor), `error`, `hint`, disabled                                                         | Every text/number/date input.                                                                                                      |
| `Select`                                     | label, `error`, disabled                                                                           | Choices: room, duration, recurrence, time.                                                                                         |
| `Modal`                                      | `open`, `title`, `onClose`; focus trap, Esc, backdrop click, `role=dialog` + `aria-modal`          | Add/edit room; any focused one-task dialog.                                                                                        |
| `Toast`                                      | `success` / `error`; auto-dismiss 4s; `aria-live` region                                           | Operation feedback (created, cancelled, conflict message).                                                                         |
| `Badge`                                      | tones `success/warning/danger/neutral/primary`; icon + text (never color alone)                    | Booking status, room active state, role.                                                                                           |
| `Table`                                      | headers, caption, zebra/hover rows, `emptyMessage` row                                             | Bookings list, admin room table, usage report.                                                                                     |
| `Spinner` / `Skeleton`                       | sizes; `Label`                                                                                     | Loading states (never a blank flash).                                                                                              |
| `LoadingState` / `EmptyState` / `ErrorState` | —                                                                                                  | The three required UX states of every data view.                                                                                   |

## UX contract

- **Every data view** (RoomGrid, MyBookings, AdminRooms, usage report) renders **loading** (skeleton/spinner), **empty** (message + call to action), and **error** (friendly message + Retry) states.
- **Double-submit safety**: submit buttons show a spinner and are disabled while in flight.
- **Feedback**: success/failure arrives via toast showing the API's error message text from the shared `{ error }` contract; 409 conflicts also render inline above the form.
- **Accessibility (WCAG AA basics)**: keyboard-reachable nav and forms, visible `:focus-visible` ring token, ≥ 4.5:1 contrast (checked on primary/text/danger tokens), status never conveyed by color alone, real labels (`htmlFor`), modals announce `role="dialog"`/`aria-modal`, toasts use `aria-live="polite"`.

## Layout

- Sticky header: brand, nav (Room grid / My bookings / Admin), user menu (name + role badge + Log out).
- Max-width 1080px container; 4/8px spacing rhythm; `page-title` (xl) > `section-title` (lg) > body hierarchy.
- Responsive from ≥360px: header wraps, tables scroll horizontally, user name hides on narrow screens.
