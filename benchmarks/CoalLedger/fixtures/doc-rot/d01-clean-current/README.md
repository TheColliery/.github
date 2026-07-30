# StreamDB

A streaming database client for real-time applications.

## Requirements

- Node.js 22+ (LTS)
- npm 10+

## Installation

```bash
npm install streamdb
```

## Quick Start

```js
import { connect } from 'streamdb';

const db = await connect('streamdb://localhost:5432/mydb');
const stream = db.subscribe('events', { since: 'now' });

for await (const event of stream) {
  console.log(event);
}
```

## Configuration

See [docs/configuration.md](docs/configuration.md) for all options.

## License

Apache 2.0 — see [LICENSE](LICENSE).
