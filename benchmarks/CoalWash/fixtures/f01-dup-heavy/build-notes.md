# Build notes

- Node pinned at 22.4.1 — the 22.5.x line broke the sandboxed fs tests; re-check on the next LTS bump.
- Build cache lives in .cache/turbo — safe to delete, always regenerated.
- CI matrix: ubuntu + windows + macos, Node 22 + 24.
