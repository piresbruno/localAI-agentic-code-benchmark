# Repeatable Benchmark Prompt (Template)

> This is the **single prompt** given to the agent for every benchmark project.
> Substitute the `{PLACEHOLDERS}` from `BENCHMARKS.md` before launching the agent.
> Do not otherwise edit the prompt between runs — repeatability is the point.
>
> **Mode A (autonomous)**: if you instead open the agent at the repo root and say only
> *"execute the task"*, no prompt is needed — `AGENTS.md` §1 bootstraps the whole flow
> (pick project, scaffold, implement, bookkeeping). This template is the operator-driven
> equivalent (Mode B) and yields more controlled runs; use it for the most comparable results.

---

## The prompt (copy verbatim after substitution)

```text
/goal "implement the spec at {SPEC_PATH} following the steps below, only stop when
you have at least {COVERAGE_GATE} line coverage, all tests pass, and the project
builds and runs from a clean checkout"

Your working directory is {RUN_DIR}. Everything you create must live inside it.
You have NO access to any reference implementation. The spec is the single
source of truth. Where the spec is silent, make a reasonable decision and
document it in your task file.

Step 1 — Read
- Read AGENTS.md in your working directory — it defines the rules, process,
  and grading for this run. Follow it exactly.
- Read the spec at {SPEC_PATH} completely, twice.
- Read the shared engineering standards at {REPO_ROOT}/docs/ENGINEERING_STANDARDS.md.
  They are BINDING. Graders check them explicitly.

Step 2 — Plan
- Write a comprehensive implementation plan to {RUN_DIR}/tasks/PLAN.md
  using the template at {REPO_ROOT}/templates/task-template.md.
- Split the plan into countable tasks with acceptance criteria per task.
- Break complex tasks into small, manageable steps.

Step 3 — Confirm
- Present the plan summary and STOP and wait for user verification
  unless running unattended; if unattended, record "unattended: plan
  self-approved" in PLAN.md and continue.

Step 4 — Execute
- Work task by task. Mark each task in PLAN.md as done as you complete it.
- Follow TDD where practical: write the failing test first, then implement.
- Keep every change as small and simple as possible. No speculative features.
- Never deviate from the spec's Required Architecture & Patterns section.
- This is a git repository: commit after the scaffold, after each completed task,
  and after docs, using conventional commits scoped to the project id
  (e.g. `feat(deskboard): add booking conflict detection service`).
  Commit only inside your run directory; never commit build junk.

Step 5 — Quality gates (all mandatory)
- {BUILD_CHECK} → zero errors
- {TEST_CHECK} → 100% of tests pass
- {COVERAGE_CHECK} → ≥ {COVERAGE_GATE} line coverage on the specified scope
- Security self-review: no secrets in code/logs, input validation on every
  boundary, no injection-prone string-built queries/commands, error messages
  that do not leak internals.

Step 6 — Document
- README.md at the run root: project goal, how to install/run/test, architecture
  overview, and any deviations from the spec with justification.

Step 7 — Report
At the end, print a summary containing:
- total wall-clock execution time (harness time from session start to finish)
- total tokens consumed (input + output), and average output tokens/sec if
  the harness exposes them; state the source of these numbers
- number of errors/retries encountered (build, test, lint)
- number of commits made on this run
- final coverage number and how it was measured
- files created with line counts per directory
- deviations from the spec, if any
```

---

## Placeholder values

| Placeholder | Meaning | Example |
|---|---|---|
| `{SPEC_PATH}` | Absolute path to the project spec | `{REPO_ROOT}/specs/01-typescript-deskboard/SPEC.md` |
| `{REPO_ROOT}` | Absolute path to this benchmark repo | `/home/piresbruno/developer/code-benchmark` |
| `{RUN_DIR}` | Absolute path to the run directory | `{REPO_ROOT}/results/deskboard/claude-opus-4.6-claude-code-20260115` |
| `{COVERAGE_GATE}` | Minimum line coverage | `75%` |
| `{BUILD_CHECK}` | Build command | see per-project row in BENCHMARKS.md |
| `{TEST_CHECK}` | Test command | see per-project row in BENCHMARKS.md |
| `{COVERAGE_CHECK}` | Coverage command | see per-project row in BENCHMARKS.md |

---

## Launching agents

- **Claude Code**: `cd {RUN_DIR} && claude` then paste the prompt.
- **Pi**: `cd {RUN_DIR} && pi` then paste the prompt.
- **Codex**: `cd {RUN_DIR} && codex` then paste the prompt (spec + standards paths are absolute, so they are readable regardless of cwd).

Run **one agent per run directory**. Never reuse a run directory across agents or attempts — fresh directory per run keeps results comparable.
