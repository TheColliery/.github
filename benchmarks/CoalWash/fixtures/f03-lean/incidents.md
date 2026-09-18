# Incidents

- 2026-03-08: the retry loop lacked jitter -> thundering herd on the auth service; fix = capped exponential backoff with full jitter.
- 2026-05-21: a silent catch swallowed the queue-writer error for 6 hours; rule = no empty catch, wrap with cause.
