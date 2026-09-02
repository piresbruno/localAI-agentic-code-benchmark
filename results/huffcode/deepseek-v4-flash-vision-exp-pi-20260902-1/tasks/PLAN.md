# PLAN — huffcode

**Agent/Model**: pi / deepseek-v4-flash-vision-exp
**Started**: 2026-09-02
**Spec**: specs/05-typescript-huffcode/SPEC.md (C# .NET 8 console)
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Huffcode, a .NET 8 console lossless Huffman codec (encode/decode) with
byte-deterministic `.huf` container output, a pinned deterministic Huffman
construction (lowest (frequency, symbol) merges, MSB-first, zero-padding),
one error model (single-line JSON envelope; exit 0/1/2), and complete --help.
The spec is sprint-tier (200–350 LOC) and **contract-first parallel slices**
(S1 codec, S2 format, S3 io+cli) — parallelization is scored (max_agents
bonus per spec §3.1), so this run fans out three sibling agents in one wave.

## Task breakdown

- [x] T1 — S0 scaffold: sln + Huffcode.csproj (net8.0, Nullable, TreatWarningsAsErrors), Tests csproj (xUnit + coverlet), Types.cs verbatim §4.1, sample/message.txt verbatim, slice stubs so all slices compile independently
      Accept: `dotnet build` green with stubs; fixture byte-exact (41 41 42 42 43 43 0A).
- [x] T2 — S1 codec slice (delegated to S1Codec): ByteFrequencies/BuildCodeTable/EncodeBits/DecodeBits + CodecTests (R1–R5, round-trips, edges)
      Accept: S1 tests green; pinned sample table 10→"00",65→"01",66→"10",67→"11" and bits "01011010111100".
- [x] T3 — S2 format slice (delegated to S2Format): SerializeHeader/ParseHeader/RenderContainer/ParseContainer + FormatTests (golden header, failure matrix)
      Accept: S2 tests green; golden container string round-trips byte-exactly.
- [x] T4 — S3 io+cli slice (delegated to S3IoCli): Io.ReadAllBytes/WriteAllBytes, Cli.RunCli full behavior (envelope, exit codes, help §7, version)
      Accept: S3 smoke: encode on sample → §6.2 golden bytes exactly; --help exit 0; --version prints huffcode 1.0.0.
- [x] T5 — Integration: CliTests (golden §6.2 in-process via RunCli with Console capture, exit-code matrix R9/R10, determinism, help coverage), full build/test
      Accept: `dotnet build` zero warnings; `dotnet test` all green.
- [ ] T6 — Coverage gate ≥ 85% (coverlet via `dotnet test --collect:"XPlat Code Coverage"`), smoke via `dotnet run`, README + decisions, closing bookkeeping (METRICS + BENCHMARKS + commits)
      Accept: coverage ≥ 85% on Huffcode assembly; smoke byte-match; README complete.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | `.huf` container text is written with UTF-8 encoding | Content is pure ASCII (JSON + hex); identical bytes either way. |
| 2 | Tests project targets the same `net8.0` and references the console project; `Program.Main` is the only process-exit surface | Matches spec: `Cli.RunCli` is the in-process entry; entry shim returns its code. |
| 3 | Coverage gate measured on the `Huffcode` assembly via `dotnet test --collect:"XPlat Code Coverage"` | Per BENCHMARKS.md COVERAGE_CHECK; coverlet output filtered to the Huffcode module. |
| 4 | Slice stubs committed with pinned signatures so all three sibling agents can build/test independently mid-flight | Parallelization hygiene; contracts are in the spec, no negotiation needed. |
| 5 | `ParseHeader` enforces canonical `pad == (8 - dataBits%8)%8` | Makes headers canonical → byte-deterministic output; spec §4.4 already implies it. |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
