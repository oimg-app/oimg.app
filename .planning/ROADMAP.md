# ROADMAP: oimg.app

## Milestones

- ✅ **v1.0 — UI Port** — Phases 1–7 (shipped 2026-05-25) — full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Real Optimization Pipeline** — Phases 8–12 + quick task 260603-s2x (shipped 2026-06-03) — full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 UI Port (Phases 1–7) — SHIPPED 2026-05-25 (Executed)</summary>

- [x] Phase 1: Foundation (5/5 plans)
- [x] Phase 2: Files Pane (2/2 plans)
- [x] Phase 3: Navigation Shell (3/3 plans)
- [x] Phase 4: Inspector — Codec + SVGO (4/4 plans)
- [x] Phase 5: Center Pane (2/2 plans)
- [x] Phase 6: Inspector — Output + Report (3/3 plans)
- [x] Phase 7: Polish (3/3 plans)

Shipped as **Executed** — all 22 plans built + summarized; formal phase verification skipped (see `MILESTONES.md` → Known Gaps and `STATE.md` → Deferred Items). Full phase detail, success criteria, and requirements map preserved in the archive.

</details>

<details>
<summary>✅ v1.1 Real Optimization Pipeline (Phases 8–12) — SHIPPED 2026-06-03 (audit: tech_debt)</summary>

- [x] Phase 8: Worker Pipeline Foundation (3/3 plans) — PIPE-01..04
- [x] Phase 9: Codec Encoders (4/4 plans) — ENC-01..06
- [x] Phase 10: Single-File Optimize Loop (4/4 plans) — OPT-01
- [x] Phase 11: Batch Optimize + Export (9/9 plans) — OPT-02, EXP-01, EXP-02
- [x] Phase 12: Real Snippets (5/5 plans) — SNIP-01
- [x] Quick task 260603-s2x: Watch folder (showDirectoryPicker + FileSystemObserver)

15/15 requirements satisfied. Bundle 194.88 KB gzipped (under 200 KB PIPE-02 budget). 4 Phase 12 paste-into-real-browser dogfood checks deferred to follow-up (see `milestones/v1.1-ROADMAP.md` and `v1.1-MILESTONE-AUDIT.md`).

</details>

## Next Milestone

Active milestone slot is open. Run `/gsd:new-milestone v1.2` to start scoping the next cycle. PROJECT.md flags **VAR-01 / VAR-02** (1×/2×/3× density variants via `@jsquash/resize`) and **PERS-01** (named setting presets via `idb-keyval`) as the leading deferred candidates.

---

*Last archived: 2026-06-05 via /gsd:complete-milestone v1.1*
