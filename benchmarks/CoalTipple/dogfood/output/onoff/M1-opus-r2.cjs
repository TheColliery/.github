'use strict';
const { randomUUID } = require('node:crypto');

// ponytail: one Map per resource, one generic CRUD core; the 15 exports are thin wrappers.
const stores = { users: new Map(), products: new Map(), orders: new Map() };

function assertObject(name, v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new TypeError(`${name}: data must be a non-null object`);
  }
}
function assertId(name, id) {
  if (typeof id !== 'string' || id === '') {
    throw new TypeError(`${name}: id must be a non-empty string`);
  }
}

function create(store, name, data) {
  assertObject(name, data);
  const id = typeof data.id === 'string' && data.id !== '' ? data.id : randomUUID();
  const record = { ...data, id };
  store.set(id, record);
  return { ...record };
}
function get(store, name, id) {
  assertId(name, id);
  const record = store.get(id);
  return record ? { ...record } : undefined;
}
function list(store) {
  return [...store.values()].map((r) => ({ ...r }));
}
function update(store, name, id, patch) {
  assertId(name, id);
  assertObject(name, patch);
  const existing = store.get(id);
  if (!existing) return undefined;
  const record = { ...existing, ...patch, id };
  store.set(id, record);
  return { ...record };
}
function remove(store, name, id) {
  assertId(name, id);
  return store.delete(id);
}

/** Create a user; returns the stored record with an assigned id. */
const createUser = (data) => create(stores.users, 'createUser', data);
/** Get a user by id; returns a copy or undefined. */
const getUser = (id) => get(stores.users, 'getUser', id);
/** List all users as an array of copies. */
const listUsers = () => list(stores.users);
/** Update a user by id with a patch; returns the updated record or undefined. */
const updateUser = (id, patch) => update(stores.users, 'updateUser', id, patch);
/** Delete a user by id; returns true if removed. */
const deleteUser = (id) => remove(stores.users, 'deleteUser', id);

/** Create a product; returns the stored record with an assigned id. */
const createProduct = (data) => create(stores.products, 'createProduct', data);
/** Get a product by id; returns a copy or undefined. */
const getProduct = (id) => get(stores.products, 'getProduct', id);
/** List all products as an array of copies. */
const listProducts = () => list(stores.products);
/** Update a product by id with a patch; returns the updated record or undefined. */
const updateProduct = (id, patch) => update(stores.products, 'updateProduct', id, patch);
/** Delete a product by id; returns true if removed. */
const deleteProduct = (id) => remove(stores.products, 'deleteProduct', id);

/** Create an order; returns the stored record with an assigned id. */
const createOrder = (data) => create(stores.orders, 'createOrder', data);
/** Get an order by id; returns a copy or undefined. */
const getOrder = (id) => get(stores.orders, 'getOrder', id);
/** List all orders as an array of copies. */
const listOrders = () => list(stores.orders);
/** Update an order by id with a patch; returns the updated record or undefined. */
const updateOrder = (id, patch) => update(stores.orders, 'updateOrder', id, patch);
/** Delete an order by id; returns true if removed. */
const deleteOrder = (id) => remove(stores.orders, 'deleteOrder', id);

module.exports = {
  createUser, getUser, listUsers, updateUser, deleteUser,
  createProduct, getProduct, listProducts, updateProduct, deleteProduct,
  createOrder, getOrder, listOrders, updateOrder, deleteOrder,
};
