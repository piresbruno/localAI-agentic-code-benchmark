# Grading Rubric

Score every completed run. **Pass/fail gates come first** — if any gate fails, stop grading.

## Hard fail gates (any = FAIL)

| # | Gate | How to verify |
|---|------|---------------|
| G1 | Sandboxed — nothing outside run dir was read/written/required | Inspect code for absolute paths, external services, env-only config without defaults |
| G2 | Clean checkout → install → run works (≤ 3 commands) | Fresh copy, follow README quickstart exactly |
| G3 | 100% of tests pass | Run TEST_CHECK yourself |
| G4 | Line coverage ≥ 75% on spec scope | Run COVERAGE_CHECK yourself, record number |
| G5 | Architecture matches spec's Required Architecture | Review modules vs. spec |
| G6 | Contamination — nothing outside the run dir (beyond spec, standards, plan template) was read; no other run's code/spec/history inspected | Review the transcript for reads of `results/` siblings, other specs, or git-history archaeology |

## Scored categories (0–10 each, weighted)

| Category | Weight | What 10 looks like | What 0 looks like |
|----------|--------|--------------------|-------------------|
| **Spec compliance** | ×3 | Every §requirement implemented; edge cases from the spec have named tests | Missing features, invented behavior contradicting the spec |
| **Architecture & patterns** | ×2 | Matches Required Architecture; layering inward-only; domain pure; injected clock/ids | Business logic in controllers; framework imported by domain; single-file blob |
| **Code quality** | ×2 | Idiomatic naming; small functions; no duplication; zero lint warnings; dead code absent | Copy-paste, 300-line functions, commented-out blocks, unused deps |
| **Testing quality** | ×2 | Pyramid respected; spec edge cases covered by name; meaningful assertions; deterministic | Coverage gamed with trivial asserts; order/time-dependent tests |
| **Security & validation** | ×1.5 | All boundaries validated; param queries; authz in service layer; no secret leakage | String-built SQL; unvalidated input; tokens logged |
| **UI/UX & Design System** (all projects; depth per each spec's UI section) | ×1.5 | Tokens file is single source; shared components with states; loading/empty/error everywhere; keyboard-operable, AA contrast; feedback on every action; consistent layout per spec's UI section | Inline styles/hex soup; raw errors in UI; no loading/empty/error states; keyboard traps; double-submit bugs |
| **Documentation** | ×1 | Quickstart ≤ 3 cmds; OpenAPI/--help complete; deviations listed | README missing or wrong |
| **Process discipline** | ×0.5 | PLAN.md kept current; final report with time/errors/coverage | No plan updates, no report |

**Max weighted score: 135** (all projects — both include a graded UI/UX category). Normalize to /100.

## Verdicts

- **PASS** — all gates green and score ≥ 70.
- **PASS-WITH-NOTES** — all gates green, score 50–69.
- **FAIL** — any gate red, or score < 50, or sandbox breach (automatic FAIL regardless of score).

## Evidence rule

Every score must cite evidence: file path + short quote/command output. `Code quality: 8` with nothing behind it is invalid grading.

## Grader checklist (per project, tick in RESULT.md)

- [ ] G1 sandbox — method used:
- [ ] G2 clean run — commands executed:
- [ ] G3 tests — count passed/failed:
- [ ] G4 coverage — number + command:
- [ ] G5 architecture — modules reviewed:
- [ ] Spec edge cases: list which named tests were found
- [ ] Lint clean: command + result
- [ ] Security spot-check: file reviewed for injection/authz:
