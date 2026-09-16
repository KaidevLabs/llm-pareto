---
name: tdd
description: Red-green-refactor execution loop for behavior-changing code — use when executing a plan step that declares Seams under test, or when building a feature or fixing a bug test-first.
---

# Test-Driven Development

TDD is the red → green loop: one failing test, then only the code that makes it pass, repeated in vertical slices. This skill disciplines the loop so it produces tests worth keeping; what a good *test* is (assertion quality, AAA, naming, isolation) lives in the repo's testing rules (its agent guidelines) — consult them, don't restate them here.

## Seams

A **seam** is a public boundary where behavior is observable: the interface you test through without reaching inside. Tests live at seams, never against internals.

- Seams are **declared in the step file** (`Seams under test`) and confirmed at owner review. No test is written at an undeclared seam — that is how testing effort lands on the critical paths and the complex logic, not on every edge case.
- If a seam turns out to be wrong or missing mid-step, stop and confirm with the owner — it is a plan deviation, not an executor decision.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough implementation to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle, each a tracer bullet that responds to what the last cycle taught you.
- **Refactoring is not part of the loop.** It belongs to review, after the step's behavior is green.

## Anti-patterns

- **Implementation-coupled:** mocks internal collaborators, tests private methods, or verifies through a side channel. The tell: the test breaks on a refactor that changes no behavior.
- **Tautological:** the assertion recomputes the expected value the way the code does, so it passes by construction. Expected values come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing:** all tests first, then all implementation. Bulk tests verify imagined behavior. Work vertical instead: one test → one implementation → repeat.

## Rhythm

- During the loop: run the single test file after every cycle — the repo's standard single-test invocation (its agent guidelines carry the exact command, e.g. `... test --compact tests/.../XTest.php`).
- At step close: the step file's full verification, then the repo's formatter — per the `plans` skill.
