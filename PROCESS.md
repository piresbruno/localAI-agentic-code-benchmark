# Repeatable Process — per project, per run

This is the **mandatory process** for executing and grading a benchmark project. Follow it identically for every run so results are comparable across agents, models, and time.

## Roles

- **Operator** (you): scaffolds runs (Mode B), launches agents, verifies, grades.
- **Candidate** (the AI agent): implements the project inside its run directory.

## Two launch modes

- **Mode A — autonomous (repo root)**: the agent is opened at the repo root and told only *"execute the task"*. It bootstraps itself via `AGENTS.md` §1: reads `BENCHMARKS.md`, picks the next ⬜ project, self-identifies its model, runs `new-run.sh` itself, implements, and does the closing bookkeeping (§7: metrics, status update, `build-report.py`, commits). **You then jump in at Phase 4 (verify) and Phase 5 (grade).**
- **Mode B — operator-launched (run dir)**: you scaffold (Phase 1) and paste the filled prompt. The rest is identical from Phase 2 on.

In Mode A the agent's Phase 3 metrics are **self-reported** — always overwrite/confirm them from harness telemetry in Phase 4 before grading, and mark the source in `METRICS.md`.

## Phase 0 — Setup (once per repo)

```bash
cd ~/developer/code-benchmark
# no build steps needed; this repo is specs + process only
```

## Phase 1 — Start a run

1. Pick the next project from **BENCHMARKS.md** (execute top to bottom).
2. Scaffold the run — the tested **model** must be identified; it becomes the directory name:

   ```bash
   ./scripts/new-run.sh <project-id> <model> [harness]
   # → results/<project>/<model>-<harness>-<YYYYMMDD>/
   #   e.g. results/deskboard/claude-opus-4.6-claude-code-20260115/
   # → copies RESULT.md, METRICS.md, AGENTS.md/CLAUDE.md (agent brief)
   ```

   Use the exact model id/alias you would report in a results table (e.g. `claude-opus-4.6`, `gpt-5.3-codex`, `deepseek-v4`). The harness argument distinguishes runs of the same model through different tools.
3. Fill the placeholders in **PROMPT_TEMPLATE.md** for this project.
4. Launch the agent with cwd = run directory, paste the prompt. It auto-loads `AGENTS.md` from the run directory.

## Phase 2 — During the run

Let the agent work. Intervene only if it:

- tries to write **outside** its run directory → stop it, mark `sandbox-breach`
- asks for the reference implementation → refuse; the spec is all it gets
- gets stuck > 3 attempts on the same failing test → note it for grading

The agent must keep `tasks/PLAN.md` up to date and **commit at every milestone** (scaffold, each completed task, docs, closing bookkeeping — see `AGENTS.md` §5). If it never updates the plan or dumps everything in one bulk commit, note it — process discipline is graded.

## Phase 3 — Metrics capture (token count, avg t/s, wall time) — per project

Every run records **total token count, average t/s, and total execution time** in `METRICS.md` (created by `new-run.sh`). These are the cost/speed dimensions compared across agents **per project**.

1. Note the harness session start time when you launch the agent; note the end time when it prints its final report.
2. Extract token usage from **harness telemetry** (see the "Where to find the numbers" section inside `METRICS.md` for Claude Code / Pi / Codex locations). In Mode A the agent's numbers are self-reported — replace them with harness truth. If they disagree, harness wins.
3. Fill the **yaml block** in `METRICS.md` exactly — `scripts/build-report.py` (and `collect-metrics.sh` for a terminal view) parse it for the global ranking and per-project comparison tables.
4. Retry/turnover overhead counts: tokens burned in failed builds/tests are part of the run's real cost. Do not subtract them.

## Phase 4 — Independent verification (operator, never trust the agent)

Run **all** of these yourself from a clean clone/copy of the run directory (excluding `tasks/`, `RESULT.md`):

```bash
# 1. build            (per-project BUILD_CHECK from BENCHMARKS.md)
# 2. tests            (per-project TEST_CHECK)
# 3. coverage         (per-project COVERAGE_CHECK — record the real number)
# 4. boot & smoke     (per-project SMOKE_CHECK — app must start and respond)
```

Record each result in `RESULT.md`. A gate failure here = **run failed**, regardless of what the agent claims.

## Phase 5 — Grade

Score with **docs/RUBRIC.md**. Fill every category in `RESULT.md` with evidence (file paths, command output snippets). Grades without evidence are invalid.

Also review the run's **git history** (`git log --oneline -- results/<project>/<run>`): conventional commits, one logical change each, no bulk end-commit, no junk files committed. This feeds the Process discipline score.

Hard fail gates (any one fails the whole run):

1. Sandbox breach
2. Does not build/run from clean checkout
3. Any test failing
4. Coverage < 75% (on the spec's scope)
5. Architecture does not match the spec's Required Architecture section

## Phase 6 — Record, rank & publish

1. Complete `RESULT.md` (verdict, scores, notes).
2. Copy the final `verdict` and normalized `score` (0–100) into the yaml block of `METRICS.md` (overwriting any self-reported values with harness truth).
3. Run `./scripts/build-report.py` — it scans **all** `results/*/*/METRICS.md`, ranks models per project (score ↓, tokens ↑, t/s ↓), computes the overall model leaderboard, and **regenerates `results/index.html` with every past result included** — i.e. each execution appends the new run to the global ranking. A machine-readable `results/index.json` is written alongside for CI.
4. Commit the graded artifact: `chore(benchmarks): grade <project-id> run for <model-id> — <verdict> (<score>/100)`.
5. Optionally run `./scripts/collect-metrics.sh` for a quick terminal view of the same data.
6. Leave the run directory untouched after grading — it is the artifact.

## Fairness rules

- Same spec, same prompt, same gates for every agent. **Never** tune a spec after seeing a run's results.
- One attempt per run directory; if you re-run, make a new directory.
- Time is recorded but not gated — the report is part of the deliverable. **Token count, avg t/s, and wall time are recorded per run and compared per project; they are metrics, not gates.**
- The agent may use any tools/MCPs it has; grade the outcome, not the mechanics (except sandboxing).
