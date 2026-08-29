# code-benchmark

A repeatable benchmark for evaluating AI coding agents on **real, useful software** in three languages: **TypeScript**, **Python**, and **C#**.

Each benchmark project targets **~2,000–3,000 lines of production code**, produces a **working, useful tool** (API, CLI, or full-stack app), and is graded against the same pass/fail gates and the same engineering standards.

This is a **git repository** — agents commit their work incrementally as they implement, and the commit history is part of what gets graded.

> Inspired by `~/developer/API-Agent-Test/base-repository` (Tournament API benchmark): spec-driven, sandboxed, coverage-gated, pass/fail.

## Two ways to launch

- **Autonomous**: open the agent at this repo root and say only *"execute the task"*. `AGENTS.md` §1 bootstraps everything: it reads `BENCHMARKS.md`, picks the next not-run project, self-identifies its model, scaffolds `results/<project>/<model>-<harness>-<date>/` via `new-run.sh`, implements inside it with incremental commits, and finishes with metrics + bookkeeping. You then verify and grade.
- **Operator-driven**: scaffold yourself with `scripts/new-run.sh`, paste the filled `PROMPT_TEMPLATE.md`. More controlled; use it for the most comparable runs.

---

## What's in here

```
code-benchmark/
├── README.md                  ← you are here
├── AGENTS.md                  ← the agent brief: detailed expectations & task (auto-loaded by harnesses)
├── PROMPT_TEMPLATE.md         ← the ONE repeatable prompt (parameterized per project)
├── PROCESS.md                 ← the repeatable per-project execution & grading process
├── BENCHMARKS.md              ← the execution list (one project per language, ordered)
├── docs/
│   ├── ENGINEERING_STANDARDS.md  ← cross-language code patterns & best practices (binding)
│   └── RUBRIC.md                 ← scoring rubric + hard fail gates
├── specs/                     ← one self-contained spec per benchmark project
│   ├── 01-typescript-deskboard/   (full-stack app WITH UI)
│   ├── 02-python-loglens/         (CLI + library)
│   └── 03-csharp-parkwise/        (Web API)
├── templates/
│   ├── task-template.md       ← plan file the agent must keep updated
│   ├── metrics-template.md    ← per-run metrics: total tokens, avg t/s, wall time
│   └── result-template.md     ← grading sheet per run
└── scripts/
    ├── new-run.sh             ← scaffold a run: results/<project>/<model>-<harness>-<date>/
    ├── build-report.py        ← global ranking HTML (results/index.html), append after each execution
    └── collect-metrics.sh     ← quick terminal view of per-project metrics
```

---

## The three benchmark projects

| # | ID | Language | Shape | UI | LOC target | Coverage gate |
|---|-----|----------|-------|----|-----------|---------------|
| 1 | `deskboard` | TypeScript (Node + React/Vite) | Full-stack meeting-room booking app | ✅ Yes | 2,000–3,000 | ≥ 75% (server + shared) |
| 2 | `loglens` | Python 3.11+ | CLI + library: log parsing, anomaly detection, HTML reports | No | 2,000–3,000 | ≥ 75% |
| 3 | `parkwise` | C# (.NET 8, ASP.NET Core) | Web API: parking garage management | No | 2,000–3,000 | ≥ 75% |

Full details: **[BENCHMARKS.md](BENCHMARKS.md)** — this is the list to execute, in order.

---

## How to run a benchmark (short version)

1. Pick a project from `BENCHMARKS.md`.
2. Run `scripts/new-run.sh <project-id> <model> [harness]` — the tested model is identified in the directory: `results/<project>/<model>-<harness>-<date>/`.
3. Start your agent (Claude Code, Pi, Codex…) with its working directory set to that run directory, and feed it the filled-in prompt from `PROMPT_TEMPLATE.md`. The run directory contains `AGENTS.md` (copied by the scaffold) — a detailed brief the agent auto-loads explaining what is expected, the rules, the process, and how it will be graded.
4. Let the agent work. It must follow its `AGENTS.md` brief, keep its plan in `tasks/`, and hit the fail gates.
5. Verify independently (build, test, coverage) and grade with `docs/RUBRIC.md`.
6. Capture **metrics** in `METRICS.md` — total token count, average t/s, total execution time — from harness telemetry (never the agent's self-report). After grading, add `verdict` + `score` to the same yaml block.
7. Run `scripts/build-report.py` — it appends the graded run to the **global results page** `results/index.html`: per-project ranking + overall model leaderboard. All previous runs stay ranked; nothing is lost.

Full procedure: **[PROCESS.md](PROCESS.md)**.

---

## Running the same model/harness multiple times

You can benchmark the same model/harness as often as you like — for retries after a failed grade, for stability comparisons (n-run variance), or for a new version of the model. Every scaffold gets its own directory; runs never overwrite each other:

```text
results/deskboard/gpt-5.3-pi-20260829/        ← first run of the day (base)
results/deskboard/gpt-5.3-pi-20260829-v2/     ← second run (version bump, automatic)
results/deskboard/gpt-5.3-pi-20260829-v3/     ← third run
results/deskboard/gpt-5.3-pi-20260830/        ← next day starts fresh at base
```

- `new-run.sh` detects an existing `results/<project>/<model>-<harness>-<date>/` and appends `-v2`, `-v3`, … automatically — no flags needed.
- Each versioned directory is a **completely independent run**: own `AGENTS.md`, `METRICS.md`, `RESULT.md`, `tasks/`, own git history (commits inside the run dir), own coverage.
- All versions are graded independently and all appear in the ranking. `build-report.py` parses the version suffix and treats every run as a separate row; the overall leaderboard aggregates **per model**, so a model's runs of the same project all count toward its record.
- To re-benchmark after a model update, just run the same command again — the version bump takes care of itself. Keep the model id honest (e.g. `gpt-5.3` vs `gpt-5.3-turbo`); the directory name is the run's permanent identity.

---

## Hard fail gates (all projects)

A run **fails** unless ALL of the following are true:

1. **Sandboxed** — no file/network/service dependencies outside the run directory.
2. **Runs from clean checkout** — documented install → run in ≤ 3 commands, no manual seeding.
3. **All tests pass.**
4. **Line coverage ≥ 75%** (measured per the project spec).
5. **Architecture matches the spec's Required Architecture section.**

No partial credit across gates. Everything else is graded on the rubric.

---

## Metrics tracked (per run, compared per project)

| Metric | Definition | Source |
|--------|-----------|--------|
| **Total token count** | input + output tokens, retries included | harness session telemetry |
| **Average t/s** | output tokens ÷ generation time (or ÷ wall time, noted) | derived |
| **Total execution time** | harness session start → final report | harness |

Filled into each run's `METRICS.md` yaml block; aggregated per project with:

```bash
./scripts/build-report.py
# → results/index.html  per-project ranking + overall model leaderboard
# → results/index.json  machine-readable companion
```

Metrics are **not pass/fail gates** — they are the cost/speed comparison dimensions. Compare within a project, never across projects.

---

## Code patterns & best practices

Every spec contains a **Required Architecture & Patterns** section. Cross-language expectations (error handling, validation, layering, testing pyramid, commit conventions, simplicity) are defined once in **[docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md)** and are **binding** for all three projects. Graders must check them explicitly.

