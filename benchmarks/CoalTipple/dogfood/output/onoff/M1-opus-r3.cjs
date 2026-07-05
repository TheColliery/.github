'use strict';

/** Build a CRUD suite over one module-level Map for a named resource. */
function makeStore(name) {
  const store = new Map();
  const label = name[0].toUpperCase() + name.slice(1);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const badId = (id) => typeof id !== 'string' || id === '';

  return {
    [`create${label}`](id, data) {
      if (badId(id)) throw new TypeError(`create${label}: id must be a non-empty string`);
      if (!isObj(data)) throw new TypeError(`create${label}: data must be an object`);
      if (store.has(id)) throw new TypeError(`create${label}: id "${id}" already exists`);
      const rec = { id, ...data };
      store.set(id, rec);
      return { ...rec };
    },
    [`get${label}`](id) {
      if (badId(id)) throw new TypeError(`get${label}: id must be a non-empty string`);
      const rec = store.get(id);
      return rec ? { ...rec } : undefined;
    },
    [`list${label}s`]() {
      return [...store.values()].map((r) => ({ ...r }));
    },
    [`update${label}`](id, patch) {
      if (badId(id)) throw new TypeError(`update${label}: id must be a non-empty string`);
      if (!isObj(patch)) throw new TypeError(`update${label}: patch must be an object`);
      const rec = store.get(id);
      if (!rec) throw new TypeError(`update${label}: id "${id}" not found`);
      const next = { ...rec, ...patch, id };
      store.set(id, next);
      return { ...next };
    },
    [`delete${label}`](id) {
      if (badId(id)) throw new TypeError(`delete${label}: id must be a non-empty string`);
      return store.delete(id);
    },
  };
}

module.exports = {
  ...makeStore('user'),
  ...makeStore('product'),
  ...makeStore('order'),
};
