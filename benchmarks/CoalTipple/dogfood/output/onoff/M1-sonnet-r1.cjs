'use strict';

const users = new Map();
const products = new Map();
const orders = new Map();

let userSeq = 1;
let productSeq = 1;
let orderSeq = 1;

function assertObject(data, name) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new TypeError(`${name} must be a non-null object`);
  }
}

function assertId(id, name) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new TypeError(`${name} id must be a non-empty string`);
  }
}

/** Creates a new user record and returns it. */
function createUser(data) {
  assertObject(data, 'user data');
  const id = String(userSeq++);
  const user = { id, ...data };
  users.set(id, user);
  return user;
}

/** Retrieves a user by id, or undefined if not found. */
function getUser(id) {
  assertId(id, 'user');
  return users.get(id);
}

/** Lists all users as an array. */
function listUsers() {
  return Array.from(users.values());
}

/** Updates an existing user with partial data and returns it. */
function updateUser(id, data) {
  assertId(id, 'user');
  assertObject(data, 'user data');
  if (!users.has(id)) {
    throw new TypeError(`user ${id} does not exist`);
  }
  const updated = { ...users.get(id), ...data, id };
  users.set(id, updated);
  return updated;
}

/** Deletes a user by id and returns whether it existed. */
function deleteUser(id) {
  assertId(id, 'user');
  return users.delete(id);
}

/** Creates a new product record and returns it. */
function createProduct(data) {
  assertObject(data, 'product data');
  const id = String(productSeq++);
  const product = { id, ...data };
  products.set(id, product);
  return product;
}

/** Retrieves a product by id, or undefined if not found. */
function getProduct(id) {
  assertId(id, 'product');
  return products.get(id);
}

/** Lists all products as an array. */
function listProducts() {
  return Array.from(products.values());
}

/** Updates an existing product with partial data and returns it. */
function updateProduct(id, data) {
  assertId(id, 'product');
  assertObject(data, 'product data');
  if (!products.has(id)) {
    throw new TypeError(`product ${id} does not exist`);
  }
  const updated = { ...products.get(id), ...data, id };
  products.set(id, updated);
  return updated;
}

/** Deletes a product by id and returns whether it existed. */
function deleteProduct(id) {
  assertId(id, 'product');
  return products.delete(id);
}

/** Creates a new order record and returns it. */
function createOrder(data) {
  assertObject(data, 'order data');
  const id = String(orderSeq++);
  const order = { id, ...data };
  orders.set(id, order);
  return order;
}

/** Retrieves an order by id, or undefined if not found. */
function getOrder(id) {
  assertId(id, 'order');
  return orders.get(id);
}

/** Lists all orders as an array. */
function listOrders() {
  return Array.from(orders.values());
}

/** Updates an existing order with partial data and returns it. */
function updateOrder(id, data) {
  assertId(id, 'order');
  assertObject(data, 'order data');
  if (!orders.has(id)) {
    throw new TypeError(`order ${id} does not exist`);
  }
  const updated = { ...orders.get(id), ...data, id };
  orders.set(id, updated);
  return updated;
}

/** Deletes an order by id and returns whether it existed. */
function deleteOrder(id) {
  assertId(id, 'order');
  return orders.delete(id);
}

module.exports = {
  createUser, getUser, listUsers, updateUser, deleteUser,
  createProduct, getProduct, listProducts, updateProduct, deleteProduct,
  createOrder, getOrder, listOrders, updateOrder, deleteOrder,
};
