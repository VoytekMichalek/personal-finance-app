# Testing efficiency reviewer checklist

Use this checklist for a scoped test-layer, setup, repeated-execution or concurrency change.
Record evidence in the project testing documentation or change report. This is not a fixed
test-count target or an additional R01–R19 pre-deployment gate.

- [ ] The measured bottleneck is identified using selected-case counts and timings, with runner,
  candidate, configuration, setup cost and cache conditions recorded. Wall time and total runner
  time are distinguished; unmeasured savings are labelled as estimates.
- [ ] Critical risks, assertions and their primary/complementary layers are mapped. Real HTTP/DB,
  authentication/permission, provider and browser boundaries remain covered where applicable.
- [ ] Replaced/retired tests have demonstrably equivalent risk coverage, including relevant known
  regression or controlled failure detection; missing evidence keeps the existing coverage.
- [ ] Identical selections, compatible builds and browser installation are owned once per gate/job.
  Distinct configuration, integration or release/image checks remain required.
- [ ] Independent tests can run concurrently; setup dependencies and conflicting resources are
  explicit. Accounts, records, global settings, files, seeds, auth budgets and cleanup were reviewed.
- [ ] Worker budgets match measured runner/application/database capacity, including container quotas,
  CPU affinity and other concurrently running workspaces/services. Any explicit limits or
  sequential groups have reasons; within-file parallelism is reviewed separately from worker count.
- [ ] Proposed concurrency passed repeat verification without retries and retained meaningful
  failure/cleanup checks. Changed timing-sensitive tests also passed their ten-consecutive-run rule.
- [ ] Required projects, assertions, coverage thresholds and integration/image gates are preserved;
  no hidden skips, weaker expectations or retries conceal failures.
- [ ] The full required validation passed once after the targeted verification. Documentation
  records selected commands, results, remaining gaps and the scoped adoption/rollback plan.

A documentation-only policy/reference change validates documents and changed runnable examples.
It does not require application benchmarks or certify unchanged downstream test suites.
