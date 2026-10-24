# Playwright timing reviewer checklist

- [ ] Coverage, assertions, desktop/mobile projects and justified concurrency constraints are retained; waiting/setup comparisons keep worker settings constant. Separately scoped concurrency changes follow the [efficiency checklist](testing-efficiency-review.md).
- [ ] Browser-owned timers use an installed clock before navigation/timer creation; exact-boundary tests pause before the target action.
- [ ] `fastForward()` is appropriate for deadline jumps; `runFor()` is used when repeated callbacks or retry sequences matter.
- [ ] Timeout tests prove pending behaviour before the deadline, the timeout after it and successful recovery.
- [ ] Readiness comes from observable conditions; event waits are registered before triggering actions.
- [ ] Mocked loading uses a response barrier with cleanup: assert loading, release, assert completion.
- [ ] Negative assertions cover the relevant timer window or follow established completion.
- [ ] Backend/database expiry and real media timing are not falsely accelerated with a browser clock; justified real waits are explained in the test.
- [ ] Browser engines/native dependencies are installed once per job; builds are reused where appropriate.
- [ ] No shared mutable fixtures, removed tests, hidden skips or weakened integration coverage were introduced for speed.
- [ ] Affected timing-sensitive tests passed ten consecutive runs with retries disabled; evidence includes commands, projects and workers.
- [ ] The full affected suite and repository-required checks passed after the timing validation.
- [ ] Testing/contribution documentation matches the implementation; broader migration is separately tracked.
