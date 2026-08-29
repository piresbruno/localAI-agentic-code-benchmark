# AGENTS.md — READ THIS FIRST

**You are the candidate in a coding benchmark.** This file tells you exactly what is expected, what you must build, what you must not do, and how you will be judged. Read it completely before touching any code.

You may have arrived in one of two places. **Detect your mode first:**

- **Mode A — repo root**: your cwd contains `BENCHMARKS.md`, `specs/`, `scripts/`. The operator said only *"execute the task"*. Start at **§1 Autonomous bootstrap**.
- **Mode B — inside a run directory**: your cwd contains `METRICS.md`, `RESULT.md`, `tasks/`. Your operator already scaffolded the run and gave you the prompt with the spec path. Skip to **§3 Your assignment**.

---

## 1. Autonomous bootstrap (Mode A)

Everything you need is discoverable. Execute exactly this sequence:

1. **Read the execution list** `BENCHMARKS.md`. It contains one project per language (TypeScript `deskboard`, Python `loglens`, C# `parkwise`) with a Status column and a link to each spec.
2. **Pick the next project**: the first row whose Status is "⬜ not run". Cross-check: if `results/<project>/` already contains a completed run for your model, pick the next project instead. (If all rows are done, say so and stop.)
3. **Self-identify**: your model id (e.g. `claude-opus-4.6`, `gpt-5.3`, `deepseek-v4`) and your harness (e.g. `claude-code`, `pi`, `codex`). Be honest and precise — this identifies your run forever.
4. **Scaffold the run**:
   ```bash
   ./scripts/new-run.sh <project-id> <model-id> <harness>
   ```
   This creates `results/<project>/<model>-<harness>-<date>/` containing `AGENTS.md`, `CLAUDE.md`, `METRICS.md`, `RESULT.md`, and `tasks/`. It prints the exact spec path — use it.
5. **Commit the scaffold** (see §5 Commit discipline):
   `git add results/<project>/ && git commit -m "chore(<project-id>): scaffold run for <model-id>"`
6. **`cd` into the run directory.** All implementation work happens there. Nothing may be created anywhere else.
7. **Read the spec** (path from the BENCHMARKS.md row / scaffold output) — completely, twice.
8. **Read** `docs/ENGINEERING_STANDARDS.md` — binding rules for how to build it.
9. **Continue at §3.** The spec is your contract; where it is silent, make a reasonable decision and document it in your plan's "Decisions & spec deviations" table.

If you are running attended, present your picked project + plan summary and wait for verification. If unattended (the usual case for "execute the task"), record "unattended: plan self-approved" in PLAN.md and continue.

## 2. Reference map

| Document | Path | Why |
|---|---|---|
| **Spec** | `specs/<nn-...>/SPEC.md` (given by scaffold output or your prompt) | the single source of truth for WHAT to build |
| **Engineering standards** | `docs/ENGINEERING_STANDARDS.md` | binding rules for HOW to build it |
| **Plan template** | `templates/task-template.md` | format for `tasks/PLAN.md` |

Reading those three is allowed and expected. Everything else at the repo root (other specs, past results, this file's siblings) is **off-limits** for implementation input.

## 3. Your assignment

- **Working directory**: your run directory (`results/<project>/<model>-<harness>-<date>/`).
- **Deliverable**: a complete, runnable project implementing the spec, plus updated plan, metrics, and commits.
- **Only stop** when: all tests pass, ≥ 75% line coverage on the spec's scope, the project builds and runs from a clean checkout, docs are written, bookkeeping is done (§7), and you printed the final report (§6 Step 7).

## 4. Non-negotiable rules

1. **Stay sandboxed.** Write files only inside your run directory. Build/run may not depend on anything outside it (no absolute paths, no external services, no network calls at runtime unless the spec says so). A sandbox breach fails the run.
2. **The spec is the contract.** Implement what it says. Genuinely contradictory requirements: pick the simpler reading, note it, move on — do not stall.
3. **Do not edit** `RESULT.md` (grader's sheet), the spec, the standards, or anything outside your run directory — with exactly one exception: the **closing bookkeeping** in §7 touches `BENCHMARKS.md` and `results/index.*`.
4. **No reference implementations.** Searching for this benchmark's solution online is cheating. General documentation lookups (docs, MCP tools) are fine.
5. **No fake signals.** Coverage-gaming with trivial assertions, deleting failing tests, hand-edited coverage reports = automatic fail. Do not fabricate token/usage numbers — record only what you can actually observe, and label the source.
6. **One shot.** If something breaks, fix it forward. Do not ask to restart.

## 5. Commit discipline (mandatory)

This is a git repository and **your commit history is part of the deliverable** — it is graded under Process discipline.

- **Commit at every milestone, minimum**: (1) the scaffold, (2) after each completed PLAN.md task, (3) docs, (4) the closing bookkeeping. Do not bulk-commit everything at the end.
- **Conventional commits**, scoped to the project id:
  - `feat(deskboard): add booking conflict detection service`
  - `test(loglens): cover malformed-line parser fixtures`
  - `chore(parkwise): scaffold run for gpt-5.3`
  - `docs(deskboard): add README quickstart and decisions`
  - `chore(benchmarks): mark deskboard implemented, awaiting grading`
- **Commit only your run directory** plus, at closing, `BENCHMARKS.md` and `results/index.*`. Never commit outside those paths; never commit build junk (respect `.gitignore`: `node_modules/`, `__pycache__/`, `bin/`, `obj/`, `dist/`, coverage output).
- Write meaningful messages. `update`, `fix stuff`, `wip` are rubric deductions.

## 6. The process you must follow (in order)

### Step 1 — Read
Read the spec twice, end to end. Note every named business rule and edge case — the grader looks for tests named after them. Read the engineering standards: layering, validation, error handling, security, testing pyramid.

### Step 2 — Plan
Write `tasks/PLAN.md` from the template. Countable tasks, each with an acceptance criterion. Sequence: scaffold → domain logic → persistence → boundary (HTTP/CLI/UI) → tests hardening → docs. **Commit the plan.**

### Step 3 — Confirm
Attended: present the plan summary and wait. Unattended: record "unattended: plan self-approved" in PLAN.md and continue.

### Step 4 — Execute task by task
- TDD where practical: failing test first, then implementation.
- Update PLAN.md as you go (check off tasks). A plan updated only at the end is a process failure.
- Small, simple changes. No speculative features. No clever code.
- **Commit after each completed task.**
- If a task reveals a plan error, revise the plan and note why.

### Step 5 — Quality gates (all mandatory before you claim done)
- **Build**: zero errors (spec §Commands gives the command).
- **Tests**: 100% pass, none skipped.
- **Coverage**: ≥ 75% lines on the spec's scope, measured with the spec's coverage command. Run it yourself; record the real number.
- **Boot & smoke**: start the app, hit the spec's health/UI surface, confirm clean-install behavior.
- **Security self-review**: validation on every boundary, parameterized queries, no secrets in code/logs, no internal details in error messages, auth on every protected route.
- **Lint/format clean**: zero warnings.

### Step 6 — Document
README.md: project goal, quickstart (≤ 3 commands from clean checkout), architecture overview, env vars + defaults, seeded accounts, test/coverage instructions, decisions & deviations. Public surface documented (OpenAPI/Swagger, `--help`). Deep dives in `docs/` per the spec (e.g. `docs/DESIGN.md` for deskboard). **Commit docs.**

### Step 7 — Final report (print this; it is graded)
```
== FINAL REPORT ==
- Project & status: <project-id>, implemented / partial
- Total execution time: hh:mm:ss
- Tokens consumed + avg t/s: <only if your harness exposes usage; state source, e.g. "self-reported", "unknown">
- Errors/retries: <count + what they were>
- Final coverage: <number> via <command>
- Lines of code: <per directory breakdown>
- Commits: <count> on this run
- Deviations from spec: <list or "none">
- Known gaps: <what you would fix with more time, or "none">
```
Honest gaps score better than silence — the grader will find them anyway.

## 7. Closing bookkeeping (after the final report, before stopping)

1. **Fill the yaml block in `METRICS.md`** with what you can observe (wall time; tokens/t·s only if your harness exposes usage — set `model`, leave `verdict`/`score` empty for the grader). Never fabricate numbers.
2. **Update `BENCHMARKS.md`**: set the row's Status to "🟨 implemented, awaiting grading" and append one row to the results log with your metrics and "pending grading".
3. **Run `./scripts/build-report.py`** — it regenerates `results/index.html` + `index.json`, including your run. (Your run appears ungraded; the operator adds verdict/score later and re-runs it.)
4. **Commit everything**: `chore(benchmarks): <project-id> run complete for <model-id>`.

Do NOT fill `RESULT.md` — that belongs to the grader.

## 8. How you will be graded

**Hard fail gates** (any one fails the run regardless of everything else):

1. Sandbox breach (wrote outside run dir / runtime deps outside it)
2. Does not build & run from clean checkout in ≤ 3 commands
3. Any test failing
4. Coverage < 75% on the spec's scope
5. Architecture does not match the spec's Required Architecture section

**Then scored 0–10 per category** (weighted; full detail in `docs/RUBRIC.md`): spec compliance (×3), architecture & patterns (×2), code quality (×2), testing quality (×2), security & validation (×1.5), UI/UX & design system (×1.5, deskboard only), documentation (×1), process discipline (×0.5 — includes commit history quality). Every score cites evidence.

**Metrics recorded per project** (not gates, but compared): total token count, average output t/s, total wall-clock time. The grader takes these from harness telemetry; report what you see honestly.

## 9. FAQ

**Q: The spec's LOC target (2,000–3,000) seems large. Should I pad?**
No. It indicates feature depth. Implement everything; landing short usually means missed features, not verbosity.

**Q: Can I use MCP tools / web search / Context7 for library docs?**
Yes. Documentation lookups are encouraged. Looking for this benchmark's solution is not.

**Q: The spec is silent on something.**
Decide, document it in PLAN.md's deviations table, move on.

**Q: Can I ask the operator questions?**
If attended, yes — about interpretation, never about the solution. If unattended, decide and document.

**Q: I can't finish everything. What do I do?**
Ship the best coherent subset that still builds, runs, passes its tests, and hits ≥ 75% coverage on the code that exists. List what's missing under "Known gaps" and complete the bookkeeping. A half-built mess that fails gates scores worse than a smaller complete slice.

**Q: When exactly do I commit?**
After the scaffold, after every completed task, after docs, and after the closing bookkeeping. Small, conventional, meaningful.
