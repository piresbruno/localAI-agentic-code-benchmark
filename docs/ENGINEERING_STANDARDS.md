# Engineering Standards — BINDING for all benchmark projects

These standards apply to **every** benchmark project, in addition to each spec's own Required Architecture section. Graders check them explicitly (RUBRIC §Code Quality). Where a spec contradicts this document, the spec wins.

---

## 1. Simplicity first

- Solve the spec, nothing more. No speculative abstractions, no features "we'll need later".
- Smallest change that works. Prefer boring, obvious code over clever code.
- No copy-paste duplication: extract a function when the same logic appears twice.
- Dead code, commented-out code, and unused dependencies are defects.

## 2. Layered architecture (all languages)

- **Boundary layer** (HTTP handlers / CLI commands / UI components): parse input, delegate, format output. **No business rules here.**
- **Service/domain layer**: all business rules, validation of cross-field invariants, error types defined here.
- **Data/persistence layer**: storage only. No business decisions.
- Dependencies point **inward** (boundary → service → data). The domain never imports the framework.

## 3. Validation & error handling

- Validate **every** external input at the boundary (HTTP body/query, CLI args, env vars): type, required-ness, format, range.
- One error model per project (spec defines the shape). Domain errors carry a code + safe message; transport layers map them to status codes / exit codes.
- Never leak stack traces, SQL, or internal paths to end users. Log details server-side.
- Fail fast on configuration errors at startup; never default silently to production-unsafe values.

## 4. Security baseline

- No secrets in code. Secrets via env vars with safe local defaults documented.
- Parameterized queries / ORM only — never string-built SQL.
- Auth: token validation on every protected route; authorization checks (role/ownership) in the service layer, not just at the route.
- Documented rate-limit or size caps where the spec requires them.

## 5. Testing

- **Pyramid**: many fast unit tests on the domain; fewer integration tests at the boundary (real HTTP call / CLI invocation); no UI-recorded flaky tests.
- Tests are F.I.R.S.T: Fast, Isolated, Repeatable, Self-validating, Timely.
- Every test name states behavior: `rejects_booking_when_room_already_booked` — not `test1`.
- Cover the **edge cases named in the spec** explicitly; graders look for them by name.
- No test may depend on execution order, wall-clock time (inject a clock), or network.
- Coverage gate: the **per-spec gate** — ≥ 75% lines unless the spec's probe tier raises it — on the scope defined per spec. Gaming coverage with trivial assertions (e.g., `expect(true)`) is a rubric violation, not a pass.

## 6. Asynchrony & I/O

- Async/await (or async context managers) for all I/O. No blocking calls inside request paths.
- Time, randomness, and UUID generation come from injectable providers — never direct `Date.now()`/`datetime.now()`/`Guid.NewGuid()` inside domain logic.

## 7. Naming & style

- Language-idiomatic naming (camelCase TS, snake_case Python, PascalCase/camelCase C# per convention).
- One responsibility per module/function; functions ≤ ~40 lines as a guideline.
- Public surface documented: docstrings/XML-doc on exported functions, classes, and endpoints.
- Enforce linting/formatting: ESLint+Prettier (TS), .editorconfig + built-in analyzers (C#). Zero warnings policy.

## 8. Repository hygiene

- Conventional commits: `feat(scope): …`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:` — one logical change per commit.
- README.md must let a stranger go clean-checkout → running in ≤ 3 commands.
- No generated artifacts (`node_modules`, `__pycache__`, `bin/obj`, coverage HTML) committed; `.gitignore` present.
- Configuration via environment variables with documented local defaults; one `.env.example` / `appsettings.Development.json` committed.

## 9. Documentation

- README: goal, quickstart, architecture diagram (text OK), test/coverage instructions, decisions & deviations.
- Every public HTTP/CLI surface documented (OpenAPI for APIs; `--help` output for CLIs).
- Progressive disclosure: quickstart first, details below, deep dives in `docs/`.

## 10. Process discipline (graded)

- Keep `tasks/PLAN.md` updated as work progresses (template: `templates/task-template.md`).
- Note every spec deviation with justification in one place.
- Final report must include execution time, error/retry counts, coverage number, and file/line breakdown.
