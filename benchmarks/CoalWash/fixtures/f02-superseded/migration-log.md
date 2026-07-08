# Migration log

- lesson: always disable triggers before bulk-loading (learned in the 2026-04-19 outage).
- lesson: run VACUUM ANALYZE after any table rewrite — the planner regressions otherwise linger.

This entry records, purely for completeness at the time, that the staging dry-run completed without incident and nothing further came of it; there is nothing here to carry forward.

This entry records, purely for completeness at the time, that the follow-up smoke test on the replica also completed without incident; again nothing to carry forward.
