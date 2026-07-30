# OpenWidget

An open-source widget framework for web applications.

## Installation

```bash
npm install openwidget
```

## Usage

```js
import { Widget } from 'openwidget';

const w = new Widget({ theme: 'dark' });
document.body.appendChild(w.render());
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| theme | string | `'light'` | Color theme (`'light'` or `'dark'`) |
| locale | string | `'en'` | Display language |
| debug | boolean | `false` | Enable debug logging |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
