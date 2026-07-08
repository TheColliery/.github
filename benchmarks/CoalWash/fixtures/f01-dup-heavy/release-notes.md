# Release notes

- v2.3.1 shipped 2026-05-14 — hotfix for the config walk escaping above home.
- v2.3.0 shipped 2026-05-02 — the config cascade landed.

To restate the point already captured elsewhere in this store, in full detail once again: the Node toolchain pin exists because a newer minor line broke the sandboxed fs tests, and the pin should be re-checked whenever the next LTS bump arrives, which is to say it is temporary but load-bearing for now, exactly as the build notes already record.
