---
name: tdd
description: Red-green-refactor execution loop for behavior-changing code — use when executing a plan step that declares Seams under test, or when building a feature or fixing a bug test-first.
---

# Test-Driven Development

TDD is the red → green loop: one failing test, then only the code that makes it pass, repeated in vertical slices. This skill disciplines the loop so it produces tests worth keeping; what a good *test* is (assertion quality, AAA, naming, isolation) lives in the repo's testing rules (AGENTS.md, Testing section) — consult them, don't restate them here.

## Seams

A **seam** is a public boundary where behavior is observable: the interface you test through without reaching inside. Tests live at seams, never against internals.

- Seams are **declared in the step file** (`Seams under test`) and confirmed at owner review. No test is written at an undeclared seam — that is how testing effort lands on the critical paths and the complex logic, not on every edge case.
- If a seam turns out to be wrong or missing mid-step, stop and confirm with the owner — it is a plan deviation, not an executor decision.

## Rules of the loop

- **Fail-fast precondition.** If the repo has no standard test command (the testing rules name one), stop before writing any code: making one exist is part of the step — declared at review, never improvised. Never degrade to throwaway `.tmp/` probes as a substitute for a kept suite.
- **Red before green.** The step's first act at a declared seam is the failing test: expected values written before any implementation, run red, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle, each a tracer bullet that responds to what the last cycle taught you.
- **Refactoring is not part of the loop.** It belongs to review, after the step's behavior is green.

## Anti-patterns

- **Implementation-coupled:** mocks internal collaborators, tests private methods, or verifies through a side channel. The tell: the test breaks on a refactor that changes no behavior.
- **Tautological:** the assertion recomputes the expected value the way the code does, so it passes by construction. Expected values come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing:** all tests first, then all implementation. Bulk tests verify imagined behavior. Work vertical instead: one test → one implementation → repeat.
- **Throwaway probing:** verifying step behavior with `.tmp/` scripts and moving on without committing tests. A probe that proves behavior is scaffolding: before the step closes, its assertions are promoted into kept tests at the declared seam and the probe is deleted.

## Rhythm

- During the loop: run the single test after every cycle — the repo's standard single-test invocation (the testing rules carry the exact command).
- At step close: the step file's full verification, then the repo's formatter — per the `plans` skill.
