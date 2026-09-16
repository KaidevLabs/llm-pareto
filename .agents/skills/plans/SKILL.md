---
name: plans
description: Plan lifecycle for non-trivial work under plans/ — creating plans and step files, executing or closing a step, or archiving a finished plan. Use whenever plans/ files are created, read, executed, or committed.
---

# Plans

The lifecycle for non-trivial work: **Eureka** (discover) → **Planning** (write the plan) → **Executing** (one step at a time) → **Closing** (archive). One plan per feature/issue/bug, under `plans/<slug>/`; finished plans live under `plans/archive/<slug>/`.

## Layout

- `plans/<slug>/00-overview.md` — the plan itself.
- `plans/<slug>/NN-kebab.md` — one file per step, zero-padded, in execution order.
- `plans/archive/<slug>/` — finished plans, moved whole at closing.
- Design-only plans (decisions, no code) may consist of `00-overview.md` alone.
- Plans are tracked: a plan is added to git once the design is clear and before execution starts (status `OWNER REVIEW`). At the end of every step, the step's plan updates are committed right after the step's code commit; the closing step's plan commit additionally carries the final state and the move to `plans/archive/`.

## 00-overview sections, in order

- `> **Status:**` line — the vocabulary below; closed plans carry their commit history on the same line.
- **Goal** — what reaching the end of this plan looks like.
- **Settled decisions** — the `A# | decision | rationale | date` table from the Eureka phase, marked "do not revisit".
- **Current state** — the evidenced facts the plan builds on.
- **Design** — the per-step summary.
- **Execution order** — `Step | File | Depends on | Status | Commit`, kept current at every step close.
- **Definition of done** — checklist; an item is checked only with verifiable evidence.
- **Not yet specified** (optional) — in-scope questions not yet sharp enough to become steps; they graduate into steps as the work advances.
- **Open branches** (optional) — sharp questions Eureka parked deliberately: what each hangs on, why it was parked, what would force a revisit. Distinct from Not yet specified (fog): these are stateable now, just deferred on purpose. They settle or graduate into steps as the work advances.
- **Out of scope** — work ruled beyond the goal.
- **Executor rules** — what an executor must follow; at minimum: commands via the repo's standard execution rule (e.g. a dev-container prefix), the step's verification commands plus the repo's formatter before the step closes, and the commit protocol below.

## Step files

- Title: `# Step NN — <title> — <STATUS>`.
- **As-built record** — written at close: what actually happened, deviations, owner decisions made mid-review.
- **Spec** — the files to create or edit, the changes, and "not touched in this step" for everything adjacent.
- **Verification** — the exact commands (and grep audits) that prove the step is done.
- **Seams under test** (optional) — for behavior-changing steps: the public boundaries the step's tests exercise, confirmed at owner review. The step's TDD loop never tests outside these.

## Status vocabulary

Plan, on the `> **Status:**` line:

- Execution plans: `DRAFT` → `OWNER REVIEW` → `EXECUTING (step NN/NT)` → `COMPLETE (date)` → `ARCHIVED (date)`. `COMPLETE` marks all steps committed with the archive pending; the closing step's plan commit goes straight to `ARCHIVED`.
- Design-only plans: `DRAFT` → `OWNER REVIEW` → `SETTLED (date)` → `ARCHIVED (date)`.

Step, on the title line:

- `OPEN` → `IN PROGRESS` → `✅ COMPLETE (committed <sha>, date)`, or `✅ COMPLETE (date, no code changes)` for verification-only steps.

## Lifecycle

### Eureka

Run the Eureka protocol (the `eureka` skill). Its output is the overview's Goal, Settled decisions, Current state, Open branches, Not yet specified, Out of scope, and Definition of done.

### Planning

Write `00-overview.md` and all step files, then commit them — the plan enters git at the end of planning, before execution starts. Steps are sized per the Execution mechanics below. Status → `OWNER REVIEW`. No code in the planning session. The owner reviews the plan by hand; execution starts only after the owner says go, in a separate session.

### Executing — one step at a time

Resume protocol: read the overview (status + execution order), verify the previous steps' code commits and plan commits exist, verify the tree is clean — then implement only that step.

Behavior-changing steps with declared seams are driven by the `tdd` skill: red → green in vertical slices at the declared seams, the single test file after every cycle, the step's full verification at close. Steps without seams follow their verification directly.

Step close — two commits, in order, automatic on the owner's commit signal. The owner reviews the diff and stages the code; that signal is the close signal. The agent then:

1. commits the code — plain message, current repo style;
2. writes the step's as-built record;
3. updates the step title to `✅ COMPLETE (committed <sha>, date)` — the code commit's sha, which is why the plan commit comes second;
4. updates the overview: status, the execution-order row (including the commit sha), and any Definition-of-done items the step satisfies;
5. stages the plan files and commits them: `plan: <slug> — step NN`.

Mid-step plan edits (a newly settled decision, a touched open branch) ride along in the same plan commit. A deviation from a settled decision, or a step that touches an open branch → stop and confirm with the owner; the answer settles into the Settled decisions table and the branch line moves out.

### Execution mechanics

- One step per executor: a single dedicated agent (subagent or fresh session), one at a time, in execution order. No two steps in flight.
- The right context: the step file + the 00-overview + the repo conventions must give an executor everything it needs to work without hunting or guessing. The plan author guarantees it — exact file lists, the changes, full verification commands, and "not touched in this step" for everything adjacent. An executor left to guess makes the decisions the plan should have made, and takes more steps to get there.
- Specify the what, not the how: a step file says what changes, where, and how you'll know it's done — not line-by-line how. Repo conventions cover the how.
- Divide cleanly or not at all: when the work is one logical unit that doesn't divide cleanly, it stays one step. An honest large step beats two entangled ones.

### Closing

Every plan ends with a `NN-close.md` step: the final verification (usually the full suite), the Definition-of-done audit, and this procedure. The close step follows the step-close rule: a code commit first when it has code (often it is verification-only and has none), then the closing plan commit. In it the agent:

1. updates the plan files — the close step's as-built record and title, every execution-order row, the Definition of done;
2. sets the overview status to `ARCHIVED (date)` with the plan's commit history;
3. moves `plans/<slug>/` to `plans/archive/<slug>/`, stages the plan files, and commits — the final state and the archived plan in one commit, message suffixed ` (plan: <slug>)`.
