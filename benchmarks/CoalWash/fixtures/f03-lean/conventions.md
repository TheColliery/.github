# Conventions (locked)

- error style: Result-returns for expected failures, exceptions for exceptional ones — never both for one failure class.
- config precedence: global ~/.config/app.json < project .app.json (project wins).
- commit prefix set: feat fix refactor docs test chore perf ci.
- public API changes require a deprecation window of one minor version.
