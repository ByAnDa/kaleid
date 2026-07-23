# Rendered references and time-specific baselines

These files are rendered evidence. They are not editable design source. See
`docs/handover/design-map.md` before treating any image as a target.

## Claude Design renders

| Files | Role | Last external access | Availability |
|---|---|---|---|
| `kaleid-final.png`, `tokens-dark-mid.png`, `tokens-light.png`, `canvas-overview.png` | v1 palette and historical layout renders | 2026-05-22 | Claude Design source is no longer authorized/retrievable; repo source/archive is authoritative |
| `01-v2-multi.png`, `02-v2-multi.png`, `v2-chats.png`, `v2-overview.png`, `v2-streaming.png` | v2 layout/state renders | 2026-05-26 | Claude Design source is no longer authorized/retrievable; repo source is authoritative |

Integrity note: `v2-chats.png` and `v2-overview.png` are byte-identical
(`sha256:b22a5286c675792be783b063b440389d7c859cd76bf90d837ed584fec77de042`).
Their two filenames do **not** prove two distinct captured states.

The Claude exporter gave all nine renders `.png` filenames, but their file
signatures are JPEG/JFIF. The historical names are retained so old references
and migration grep remain stable.

## Recovered message attachments

Recovered from Raft on 2026-07-23 before any future redesign:

| File | Original message / attachment | Role |
|---|---|---|
| `baseline-spec-012-pi-model-selector.png` | `#kaleid-spec` msg `59c0489c`, attachment `4dd0e0ab` (2026-05-22) | pi model-selector comparison; external-product reference only, never a kaleid canonical target |
| `baseline-spec-022-tui-layout.png` | msg `02b0cfca`, attachment `6db4f084` (2026-05-23) | pre-spec-022 current-state/before evidence |
| `baseline-spec-024-input.png` | msg `e4f60c6f`, attachment `c47e6537` (2026-05-23) | pre-spec-024 input alignment/background before evidence |
| `baseline-spec-024-resume.png` | msg `e4f60c6f`, attachment `b72996af` (2026-05-23) | pre-spec-024 resume-filter visibility before evidence |

The three kaleid baseline captures document historical defects and must not
override later approved specs or the canonical v2 source.
