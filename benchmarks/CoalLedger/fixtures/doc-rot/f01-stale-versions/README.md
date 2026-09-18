# DataSync

A real-time data synchronization library.

## Requirements

- Node.js 14+ (LTS recommended)
- npm 6.x or yarn 1.x
- Redis 5.0+

## Installation

```bash
npm install datasync@3.2.1
```

Make sure you have TypeScript 4.7+ installed globally.

## Compatibility

| Database | Tested Version | Status |
|----------|---------------|--------|
| PostgreSQL | 12.x | Supported |
| MySQL | 5.7 | Supported |
| MongoDB | 4.4 | Supported |
| SQLite | 3.35 | Experimental |

## Docker

```yaml
# docker-compose.yml
version: "3.8"
services:
  app:
    image: datasync:3.2.1
    depends_on:
      - redis
  redis:
    image: redis:6.2-alpine
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history. Current release: v3.2.1 (2024-03-15).

Last reviewed: January 2024.
