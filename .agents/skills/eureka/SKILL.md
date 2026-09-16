---
name: eureka
description: Discovery protocol for analyzing a problem with the owner before planning or code — use when starting a new feature, bug, or problem that needs decisions settled, or before writing anything under plans/.
---

# Eureka

The discovery phase — analyzing a problem with the owner before any plan or work. Use whenever a problem is big or ambiguous enough that deciding wrong costs a session, and always before writing a plan under `plans/`.

## Protocol

- Evidence before questions: verify the current state with evidence first — grep, DB, tests, logs. Only ask what the evidence cannot answer. Every current-state claim in the resulting plan carries its evidence.
- One question at a time. The owner decides; the agent never stands in for the owner's side of the exchange — an agent that answers its own questions has broken the protocol.
- Record settled decisions immediately: each one lands in the plan's **Settled decisions** table (`A# | decision | rationale | date`), marked "do not revisit". A decision without its rationale is an invitation to relitigate.
- Track what is not yet specifiable: questions you can tell are coming but cannot yet state sharply go to **Not yet specified**. The test is whether the question is sharp, not whether it is answerable — sharp questions become steps, the rest waits.
- Close with **Out of scope** (work ruled beyond the goal — scope, not sharpness, lands it there) and a **Definition of done** checklist whose items are verifiable.
- Close the branches before stopping: for every settled decision, one level out — what hangs on it. Each branch must end recorded: settled (the decisions table), asked in the session, parked deliberately as a sharp open question (a line in the plan's **Open branches**), or fog (**Not yet specified**). An opened branch may not silently evaporate — "the way is clear" is something the owner can verify at plan review, not an agent assertion.
- Stop when the way is clear: hand off to planning (the `plans` skill), or stop at a design document when no code is involved. The pull to start doing the work is the signal the discovery is done.
