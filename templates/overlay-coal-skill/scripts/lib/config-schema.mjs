// Single source of truth for every .{{TOOL}}.json key.
// verify.mjs validates against it; configure.mjs builds its CLI flags, parsing,
// and help text from it — a key added here is automatically validated,
// settable, and documented, so the two scripts can never drift apart.
//
// Sourced from CoalMine's exemplar (scripts/lib/config-schema.mjs, live
// 2026-09-03) — the SHAPE is copied verbatim, the KEY LIST below is a
// placeholder. Fill it with this tool's own real config keys; do not ship
// this file with the placeholder row still in it.
//
// Spec fields:
//   key       canonical .{{TOOL}}.json key
//   type      'bool' | 'int' | 'enum' | 'strArr'
//   min/max   optional bounds for 'int' (inclusive)
//   values    allowed values for 'enum' (compared case-insensitively)
//   titleCase store enum Title-Cased (rare — most enums stay lowercase)
//   lower     lowercase each 'strArr' item on write
//   flags     extra CLI aliases besides --<key>
//   help      one-line description for --help

export const CONFIG_SCHEMA = [
  // {{PLACEHOLDER}} — replace with this tool's real keys. Example shape:
  // { key: 'mode', type: 'enum', values: ['auto', 'manual', 'off'], help: 'Run mode (auto, manual, off; default: auto)' },
];

// Validate an already-parsed JSON value against a spec.
// Returns an error message fragment ("must be ...") or null when valid.
export function validateValue(spec, v) {
  switch (spec.type) {
    case 'bool':
      return typeof v === 'boolean' ? null : 'must be a boolean';
    case 'int':
      if (typeof v !== 'number' || !Number.isFinite(v)) return 'must be a finite number';
      if (!Number.isInteger(v)) return 'must be an integer';
      if (spec.min != null && v < spec.min) return `must be >= ${spec.min}`;
      if (spec.max != null && v > spec.max) return `must be <= ${spec.max}`;
      return null;
    case 'enum':
      return typeof v === 'string' && spec.values.includes(v.toLowerCase())
        ? null
        : `must be one of: ${spec.values.join(', ')}`;
    case 'strArr':
      return Array.isArray(v) && v.every((x) => typeof x === 'string')
        ? null
        : 'must be an array of strings';
    default:
      return `has an unknown spec type '${spec.type}'`;
  }
}
