# Task Contract: Post-MVP Release-Readiness & GitHub CLI Verification

## Problem
While all five feature phases of Mannostree have been implemented and validated in prepare-only mode (54 unit and integration tests passing across 20 suites), two critical release-readiness gaps remain:
1. **Unmeasured Code Coverage**: Vitest coverage configuration was missing, leaving release quality thresholds unmeasured and unverified.
2. **Unverified GitHub CLI Publishing Path**: In `src/core/publish.ts`, GitHub PR creation invoked `this.git.exec(['gh', ...])` (which mistakenly ran `git gh`), and no adapter-level or mocked executable test existed to verify that `--push` invokes `gh pr create` with correct arguments, parses PR URLs/numbers, and handles `gh` absence/errors gracefully.

## Scope
1. **Vitest V8 Code Coverage System**:
   - Configure `@vitest/coverage-v8` in `vitest.config.ts`.
   - Add `npm run test:coverage` and `npm run coverage` scripts in `package.json`.
   - Establish coverage thresholds and produce complete text, JSON, and HTML reports.
2. **GitHub CLI Adapter & Safe Binary Execution**:
   - Implement clean `GhAdapter` / `execBinary` mechanism in `src/core/publish.ts` to execute `gh pr create` as a dedicated binary rather than through `git`.
   - Support adapter injection for deterministic unit testing and mocked executable integration tests.
   - Verify `--push` flow end-to-end: remote git push, `gh pr create` invocation with `--head`, `--base`, `--title`, `--body-file`, `--draft`, URL/number extraction, and graceful degradation when `gh` is unavailable.
3. **Comprehensive Verification**:
   - Unit tests covering both successful `gh` execution and error fallback modes.
   - Mocked executable integration test verifying `--push` end-to-end.
   - Measure and record 100% accurate coverage metrics.

## Out-of-Scope
- Automatically pushing to real remote repositories without user authorization.
- Merging pull requests or modifying remote repository branch protection.

## Acceptance Criteria
- [ ] `npm run lint`: 0 TypeScript type errors.
- [ ] `npm run build`: Clean build into `dist/`.
- [ ] `npm run coverage`: Generates real coverage metrics across all core subsystems.
- [ ] GitHub CLI `--push` flow verified with real adapter-level and mocked executable tests.
- [ ] All safety invariants preserved (prepare-only default, no auto-merge, no auto-delete).

## Explicit Assumptions & Safety Invariants
- Base branch: `main`.
- Default publishing mode: `prepare-only`.
- External publishing requires explicit `--push` flag.
