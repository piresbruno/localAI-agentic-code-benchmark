# DeskBoard Design System

The design system is tokens first: `client/src/styles/tokens.css` is the **only** place that defines raw values. Every component and page stylesheet consumes `var(--…)` — no hardcoded hex colors, font sizes, or off-scale spacing anywhere else.

## Tokens

| Group | Tokens | Notes |
|---|---|---|
| Primary color | `--color-primary`, `--color-primary-strong`, `--color-primary-soft`, `--color-on-primary` | Blue scale; `on-primary` white text passes AA on both primary shades |
| Neutrals | `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-strong` | `text` on `surface` ≈ 14:1 contrast; `text-muted` ≥ 4.5:1 |
| Semantic | `--color-success|warning|danger` + `--color-*-soft` | Always paired with an icon/text glyph — status is never color alone |
| Typography | `--text-xs/sm/md/lg/xl` with matching `--text-*-line` | 12/14/16/20/28 px, unitless line-heights |
| Spacing | `--space-1…8` | 4/8px grid: 4, 8, 12, 16, 24, 32, 48, 64 |
| Radii | `--radius-sm` (4px), `--radius-md` (8px), `--radius-full` | |
| Shadows | `--shadow-1`, `--shadow-2` | Elevation for header/cards and modals/toasts |
| Focus | `--focus-outline`, `--focus-offset` | One visible focus ring for the whole app |

## Components (`client/src/components/ui/`)

| Component | Variants / states | Use it for |
|---|---|---|
| `Button` | `primary` / `secondary` / `danger`; `loading` (spinner + disabled + `aria-busy`); disabled | All actions. Primary = the one main action per view; secondary = navigation/cancel; danger = destructive (cancel booking, deactivate room) |
| `TextField` | visible label tied via `htmlFor`, error slot (`aria-describedby`, `aria-invalid`), disabled, hint | Free-form input |
| `Select` | same contract as TextField | Room, start time, duration |
| `Modal` | `role="dialog"` + `aria-modal`, focus trap, Esc + backdrop close, focus restored | Admin room add/edit |
| `Toast` | success/error, auto-dismiss (4s), single `role="log"` `aria-live` region | Feedback for every mutation; carries the API's error message text |
| `Table` | header row, hover rows, empty-state row (`colSpan`) | Admin rooms |
| `Spinner` | `role="status"`, small (inside buttons) / large | All loading states |

Every component implements hover, `:focus-visible`, and disabled states.

## UX states

Every data view (RoomGrid, MyBookings, AdminRooms) goes through the shared `DataState` wrapper:

- **Loading** — spinner in a bordered panel; never an unstyled blank flash.
- **Empty** — human message + call to action ("No bookings yet — pick a room…").
- **Error** — friendly message (never raw JSON/stack) + **Try again** retry button.

Submits are **double-submit safe**: buttons disable while in flight, showing pending state via the `loading` prop.

## Accessibility

- Fully keyboard operable: logical tab order through forms; modal focus trap with wrap-around; Esc/backdrop close.
- Visible focus ring from `--focus-outline` on every interactive element.
- Body text contrast ≥ 4.5:1 (`--color-text`/`--color-text-muted` on `--color-surface`).
- Status chips pair icon + text (`✓ confirmed`, `✕ cancelled`), never color alone.
- Real labels on all inputs; `aria-live` toasts; `aria-busy` on in-flight buttons.

## Layout

- Consistent scaffold: sticky header (app name, primary/secondary nav, user menu with logout), `.container` max-width from `--container-max`, section rhythm from the spacing scale.
- The room grid is a rooms × hours matrix (08:00–19:00, hourly) with horizontal scroll below 720px; responsive ≥ 360px.
