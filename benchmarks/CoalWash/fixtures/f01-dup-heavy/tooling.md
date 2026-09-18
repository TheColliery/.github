# Tooling

- ripgrep replaces grep in scripts (rg --no-ignore) — plain grep missed CRLF-mixed files on Windows.

To restate the point already captured elsewhere in this store, in full detail once again: the build cache directory is disposable and always regenerated, so deleting it is safe whenever disk pressure appears, exactly as the build notes already record.

On the general subject of tool choices, it is perhaps worth pausing here to reflect at some length: choosing tools is a matter of trade-offs, and trade-offs depend on context, and context shifts over time, so any tool decision recorded here should be read as provisional rather than final, which is true of most engineering decisions in general and therefore adds nothing specific to this project.
