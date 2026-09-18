'use strict';

// ponytail: three resources are near-identical CRUD; one factory builds all 15 instead of copy-pasting 5 funcs x 3.

/** Module-level stores, one Map per resource. */
const stores = { users: new Map(), products: new Map(), orders: new Map() };

/** Throw a TypeError with `msg` unless `cond` is truthy. */
function assert(cond, msg) { if (!cond) throw new TypeError(msg); }

/** Validate that `id` is a non-empty string. */
function checkId(id, label) { assert(typeof id === 'string' && id.length > 0, `${label}: id must be a non-empty string`); }

/** Validate that `data` is a plain-ish non-null object (not array). */
function checkData(data, label) { assert(data !== null && typeof data === 'object' && !Array.isArray(data), `${label}: data must be a non-null object`); }

/** Build the 5 CRUD functions for one named resource backed by `store`. */
function makeCrud(name, store) {
  const cap = name[0].toUpperCase() + name.slice(1);
  return {
    /** Create a record; throws if id is bad or already exists. */
    [`create${cap}`](id, data) {
      checkId(id, `create${cap}`);
      checkData(data, `create${cap}`);
      assert(!store.has(id), `create${cap}: id "${id}" already exists`);
      const record = { id, ...data };
      store.set(id, record);
      return { ...record };
    },
    /** Get a record by id, or undefined if absent. */
    [`get${cap}`](id) {
      checkId(id, `get${cap}`);
      const record = store.get(id);
      return record === undefined ? undefined : { ...record };
    },
    /** List all records as an array (copies). */
    [`list${cap}s`]() {
      return Array.from(store.values(), (r) => ({ ...r }));
    },
    /** Merge `data` into an existing record; throws if id is bad or missing. */
    [`update${cap}`](id, data) {
      checkId(id, `update${cap}`);
      checkData(data, `update${cap}`);
      assert(store.has(id), `update${cap}: id "${id}" not found`);
      const record = { ...store.get(id), ...data, id };
      store.set(id, record);
      return { ...record };
    },
    /** Delete a record by id; returns true if it existed. */
    [`delete${cap}`](id) {
      checkId(id, `delete${cap}`);
      return store.delete(id);
    },
  };
}

module.exports = {
  ...makeCrud('user', stores.users),
  ...makeCrud('product', stores.products),
  ...makeCrud('order', stores.orders),
};
