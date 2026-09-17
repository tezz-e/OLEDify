# BRIEFING — 2026-09-17T18:28:16Z

## Mission
Orchestrate complete implementation and verification of web-based OLED Visual Animation Engine & Converter (Vite + React) and hardware/export workflows.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: D:\espprojects\oled\.agents\orchestrator
- Original parent: Sentinel
- Original parent conversation ID: f3bcaf97-3b76-4041-b0c3-c9a351147c7d

## 🔒 My Workflow
- **Pattern**: Project Pattern
- **Scope document**: D:\espprojects\oled\PROJECT.md
1. **Decompose**: Survey codebase/specs via 3 parallel explorers, synthesize into PROJECT.md, define milestones and interface contracts.
2. **Dispatch & Execute**:
   - **Delegate (sub-orchestrator)**: Decompose into modular milestones, dispatch sub-orchestrators for milestones and E2E testing orchestrator in parallel.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: N/A (top-level orchestrator must redesign)
4. **Succession**: Self-succeed at 20 spawns (write handoff.md, cancel crons, spawn successor)
- **Work items**:
  1. Survey & Scope Mapping [in-progress]
  2. Project Decomposition & PROJECT.md [pending]
  3. Milestone Execution & E2E Testing Track [pending]
  4. Integration & Final Verification [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Survey codebase, existing assets, dependencies, and requirements

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- Audit is a binary veto: if Forensic Auditor reports INTEGRITY VIOLATION, milestone fails unconditionally.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: f3bcaf97-3b76-4041-b0c3-c9a351147c7d
- Updated: 2026-09-17T18:28:16Z

## Key Decisions Made
- Selected Project Pattern with dual-track architecture (Implementation + E2E Testing).
- Survey phase spawned 3 parallel Explorers: Codebase/PlatformIO Explorer, Spec/Media/Web Engine Explorer, and Firmware/Hardware Protocol Explorer.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_1 | teamwork_preview_explorer | Survey existing codebase & hardware setup | completed | 4430074a-53f3-4dc0-89c2-76a219699174 |
| explorer_survey_2 | teamwork_preview_spec_miner | Spec mine web engine, formats, dithering & player | completed | bc2d6cb1-98f4-4897-9f8f-96140ba99998 |
| explorer_survey_3 | teamwork_preview_spec_miner | Spec mine WebSerial, C++ exporter & procedural FX | completed | 44f10372-2bc7-403f-802a-fa8b06f17e7e |
| sub_orch_m1 | self | Milestone M1: Web Studio Foundation & Media Ingestion | in-progress | c335cf6b-2b25-4534-bccd-41c60c2542ba |
| sub_orch_e2e | self | E2E Testing Track Orchestrator (Tiers 1-4) | in-progress | 157bdbf5-2620-42ba-90f5-ea86cd6049fb |

## Succession Status
- Succession required: no
- Spawn count: 5 / 20
- Pending subagents: c335cf6b-2b25-4534-bccd-41c60c2542ba, 157bdbf5-2620-42ba-90f5-ea86cd6049fb
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 9cea43f2-151e-4fe1-9c10-7dfec5d36b10/task-21
- Safety timer: pending
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- D:\espprojects\oled\.agents\ORIGINAL_REQUEST.md — Authoritative User Request
- D:\espprojects\oled\.agents\orchestrator\DISPATCH.md — Dispatch log
- D:\espprojects\oled\.agents\orchestrator\plan.md — Orchestrator project plan
- D:\espprojects\oled\.agents\orchestrator\progress.md — Liveness & execution progress
- D:\espprojects\oled\PROJECT.md — Global project architecture & feature inventory
