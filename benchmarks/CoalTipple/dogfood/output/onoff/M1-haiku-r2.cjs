// store.js - In-memory REST-style store module

const usersStore = new Map();
const productsStore = new Map();
const ordersStore = new Map();

let userIdCounter = 1;
let productIdCounter = 1;
let orderIdCounter = 1;

/**
 * Create a new user in the store.
 */
function createUser(userData) {
  if (!userData || typeof userData !== 'object' || Array.isArray(userData)) {
    throw new TypeError('userData must be a non-null object');
  }
  if (typeof userData.name !== 'string' || userData.name.trim() === '') {
    throw new TypeError('userData.name must be a non-empty string');
  }
  if (userData.email !== undefined && (typeof userData.email !== 'string' || userData.email.trim() === '')) {
    throw new TypeError('userData.email must be a non-empty string');
  }

  const id = userIdCounter++;
  const user = { id, ...userData };
  usersStore.set(id, user);
  return user;
}

/**
 * Retrieve a user by ID from the store.
 */
function getUser(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return usersStore.get(id);
}

/**
 * Retrieve all users from the store.
 */
function listUsers() {
  return Array.from(usersStore.values());
}

/**
 * Update an existing user in the store.
 */
function updateUser(id, userData) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  if (!userData || typeof userData !== 'object' || Array.isArray(userData)) {
    throw new TypeError('userData must be a non-null object');
  }
  if (!usersStore.has(id)) {
    throw new TypeError('user not found');
  }

  const existingUser = usersStore.get(id);
  const updated = { ...existingUser, ...userData, id };
  usersStore.set(id, updated);
  return updated;
}

/**
 * Delete a user from the store.
 */
function deleteUser(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return usersStore.delete(id);
}

/**
 * Create a new product in the store.
 */
function createProduct(productData) {
  if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
    throw new TypeError('productData must be a non-null object');
  }
  if (typeof productData.name !== 'string' || productData.name.trim() === '') {
    throw new TypeError('productData.name must be a non-empty string');
  }
  if (typeof productData.price !== 'number' || productData.price < 0) {
    throw new TypeError('productData.price must be a non-negative number');
  }

  const id = productIdCounter++;
  const product = { id, ...productData };
  productsStore.set(id, product);
  return product;
}

/**
 * Retrieve a product by ID from the store.
 */
function getProduct(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return productsStore.get(id);
}

/**
 * Retrieve all products from the store.
 */
function listProducts() {
  return Array.from(productsStore.values());
}

/**
 * Update an existing product in the store.
 */
function updateProduct(id, productData) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
    throw new TypeError('productData must be a non-null object');
  }
  if (!productsStore.has(id)) {
    throw new TypeError('product not found');
  }

  const existingProduct = productsStore.get(id);
  const updated = { ...existingProduct, ...productData, id };
  productsStore.set(id, updated);
  return updated;
}

/**
 * Delete a product from the store.
 */
function deleteProduct(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return productsStore.delete(id);
}

/**
 * Create a new order in the store.
 */
function createOrder(orderData) {
  if (!orderData || typeof orderData !== 'object' || Array.isArray(orderData)) {
    throw new TypeError('orderData must be a non-null object');
  }
  if (typeof orderData.userId !== 'number' || orderData.userId < 1) {
    throw new TypeError('orderData.userId must be a positive number');
  }
  if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
    throw new TypeError('orderData.items must be a non-empty array');
  }

  const id = orderIdCounter++;
  const order = { id, ...orderData };
  ordersStore.set(id, order);
  return order;
}

/**
 * Retrieve an order by ID from the store.
 */
function getOrder(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return ordersStore.get(id);
}

/**
 * Retrieve all orders from the store.
 */
function listOrders() {
  return Array.from(ordersStore.values());
}

/**
 * Update an existing order in the store.
 */
function updateOrder(id, orderData) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  if (!orderData || typeof orderData !== 'object' || Array.isArray(orderData)) {
    throw new TypeError('orderData must be a non-null object');
  }
  if (!ordersStore.has(id)) {
    throw new TypeError('order not found');
  }

  const existingOrder = ordersStore.get(id);
  const updated = { ...existingOrder, ...orderData, id };
  ordersStore.set(id, updated);
  return updated;
}

/**
 * Delete an order from the store.
 */
function deleteOrder(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  return ordersStore.delete(id);
}

module.exports = {
  createUser,
  getUser,
  listUsers,
  updateUser,
  deleteUser,
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  deleteProduct,
  createOrder,
  getOrder,
  listOrders,
  updateOrder,
  deleteOrder,
};
