'use strict';

const users = new Map();
const products = new Map();
const orders = new Map();

let userSeq = 1;
let productSeq = 1;
let orderSeq = 1;

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates a user from the given data and stores it, returning the new record. */
function createUser(data) {
  assert(isPlainObject(data), 'createUser: data must be an object');
  const id = String(userSeq++);
  const record = { ...data, id };
  users.set(id, record);
  return record;
}

/** Retrieves a user by id, or undefined if not found. */
function getUser(id) {
  assert(typeof id === 'string' && id.length > 0, 'getUser: id must be a non-empty string');
  return users.get(id);
}

/** Lists all stored users as an array. */
function listUsers() {
  return Array.from(users.values());
}

/** Merges updates into an existing user and returns the updated record. */
function updateUser(id, updates) {
  assert(typeof id === 'string' && id.length > 0, 'updateUser: id must be a non-empty string');
  assert(isPlainObject(updates), 'updateUser: updates must be an object');
  assert(users.has(id), `updateUser: no user found with id ${id}`);
  const record = { ...users.get(id), ...updates, id };
  users.set(id, record);
  return record;
}

/** Deletes a user by id and returns true if a record was removed. */
function deleteUser(id) {
  assert(typeof id === 'string' && id.length > 0, 'deleteUser: id must be a non-empty string');
  return users.delete(id);
}

/** Creates a product from the given data and stores it, returning the new record. */
function createProduct(data) {
  assert(isPlainObject(data), 'createProduct: data must be an object');
  const id = String(productSeq++);
  const record = { ...data, id };
  products.set(id, record);
  return record;
}

/** Retrieves a product by id, or undefined if not found. */
function getProduct(id) {
  assert(typeof id === 'string' && id.length > 0, 'getProduct: id must be a non-empty string');
  return products.get(id);
}

/** Lists all stored products as an array. */
function listProducts() {
  return Array.from(products.values());
}

/** Merges updates into an existing product and returns the updated record. */
function updateProduct(id, updates) {
  assert(typeof id === 'string' && id.length > 0, 'updateProduct: id must be a non-empty string');
  assert(isPlainObject(updates), 'updateProduct: updates must be an object');
  assert(products.has(id), `updateProduct: no product found with id ${id}`);
  const record = { ...products.get(id), ...updates, id };
  products.set(id, record);
  return record;
}

/** Deletes a product by id and returns true if a record was removed. */
function deleteProduct(id) {
  assert(typeof id === 'string' && id.length > 0, 'deleteProduct: id must be a non-empty string');
  return products.delete(id);
}

/** Creates an order from the given data and stores it, returning the new record. */
function createOrder(data) {
  assert(isPlainObject(data), 'createOrder: data must be an object');
  const id = String(orderSeq++);
  const record = { ...data, id };
  orders.set(id, record);
  return record;
}

/** Retrieves an order by id, or undefined if not found. */
function getOrder(id) {
  assert(typeof id === 'string' && id.length > 0, 'getOrder: id must be a non-empty string');
  return orders.get(id);
}

/** Lists all stored orders as an array. */
function listOrders() {
  return Array.from(orders.values());
}

/** Merges updates into an existing order and returns the updated record. */
function updateOrder(id, updates) {
  assert(typeof id === 'string' && id.length > 0, 'updateOrder: id must be a non-empty string');
  assert(isPlainObject(updates), 'updateOrder: updates must be an object');
  assert(orders.has(id), `updateOrder: no order found with id ${id}`);
  const record = { ...orders.get(id), ...updates, id };
  orders.set(id, record);
  return record;
}

/** Deletes an order by id and returns true if a record was removed. */
function deleteOrder(id) {
  assert(typeof id === 'string' && id.length > 0, 'deleteOrder: id must be a non-empty string');
  return orders.delete(id);
}

module.exports = {
  createUser, getUser, listUsers, updateUser, deleteUser,
  createProduct, getProduct, listProducts, updateProduct, deleteProduct,
  createOrder, getOrder, listOrders, updateOrder, deleteOrder,
};
