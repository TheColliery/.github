'use strict';

/**
 * Generic in-memory CRUD helpers shared by every resource below.
 * @param {Map} store - module-level Map backing a single resource
 * @param {string} name - resource label used in validation error messages
 */
function makeCrud(store, name) {
  let nextId = 1;

  function assertId(id) {
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '') {
      throw new TypeError(`${name} id must be a non-empty string or number`);
    }
  }

  function assertData(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new TypeError(`${name} data must be a plain object`);
    }
  }

  return {
    create(data) {
      assertData(data);
      const id = data.id !== undefined ? data.id : nextId++;
      assertId(id);
      const record = { ...data, id };
      store.set(id, record);
      return record;
    },
    get(id) {
      assertId(id);
      return store.get(id);
    },
    list() {
      return Array.from(store.values());
    },
    update(id, changes) {
      assertId(id);
      assertData(changes);
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...changes, id };
      store.set(id, updated);
      return updated;
    },
    remove(id) {
      assertId(id);
      return store.delete(id);
    },
  };
}

const users = new Map();
const products = new Map();
const orders = new Map();

const userCrud = makeCrud(users, 'user');
const productCrud = makeCrud(products, 'product');
const orderCrud = makeCrud(orders, 'order');

/** Create a new user and store it in the users Map. */
function createUser(data) { return userCrud.create(data); }
/** Get a single user by id from the users Map. */
function getUser(id) { return userCrud.get(id); }
/** List all users currently in the users Map. */
function listUsers() { return userCrud.list(); }
/** Update an existing user by id, merging changes into the users Map. */
function updateUser(id, changes) { return userCrud.update(id, changes); }
/** Delete a user by id from the users Map. */
function deleteUser(id) { return userCrud.remove(id); }

/** Create a new product and store it in the products Map. */
function createProduct(data) { return productCrud.create(data); }
/** Get a single product by id from the products Map. */
function getProduct(id) { return productCrud.get(id); }
/** List all products currently in the products Map. */
function listProducts() { return productCrud.list(); }
/** Update an existing product by id, merging changes into the products Map. */
function updateProduct(id, changes) { return productCrud.update(id, changes); }
/** Delete a product by id from the products Map. */
function deleteProduct(id) { return productCrud.remove(id); }

/** Create a new order and store it in the orders Map. */
function createOrder(data) { return orderCrud.create(data); }
/** Get a single order by id from the orders Map. */
function getOrder(id) { return orderCrud.get(id); }
/** List all orders currently in the orders Map. */
function listOrders() { return orderCrud.list(); }
/** Update an existing order by id, merging changes into the orders Map. */
function updateOrder(id, changes) { return orderCrud.update(id, changes); }
/** Delete an order by id from the orders Map. */
function deleteOrder(id) { return orderCrud.remove(id); }

module.exports = {
  createUser, getUser, listUsers, updateUser, deleteUser,
  createProduct, getProduct, listProducts, updateProduct, deleteProduct,
  createOrder, getOrder, listOrders, updateOrder, deleteOrder,
};
