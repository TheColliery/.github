// in-memory store module with CRUD operations for users, products, and orders

const users = new Map();
const products = new Map();
const orders = new Map();

// User CRUD functions
/** @description Create a new user in the store */
function createUser(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('User id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('User data must be an object');
  if (users.has(id)) throw new TypeError('User with this id already exists');
  users.set(id, { id, ...data });
  return users.get(id);
}

/** @description Retrieve a user by id from the store */
function getUser(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('User id must be a non-empty string');
  const user = users.get(id);
  if (!user) throw new TypeError('User not found');
  return user;
}

/** @description List all users from the store */
function listUsers() {
  return Array.from(users.values());
}

/** @description Update an existing user in the store */
function updateUser(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('User id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('User data must be an object');
  if (!users.has(id)) throw new TypeError('User not found');
  const user = users.get(id);
  const updated = { ...user, ...data, id };
  users.set(id, updated);
  return updated;
}

/** @description Delete a user from the store */
function deleteUser(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('User id must be a non-empty string');
  if (!users.has(id)) throw new TypeError('User not found');
  users.delete(id);
}

// Product CRUD functions
/** @description Create a new product in the store */
function createProduct(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Product id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('Product data must be an object');
  if (products.has(id)) throw new TypeError('Product with this id already exists');
  products.set(id, { id, ...data });
  return products.get(id);
}

/** @description Retrieve a product by id from the store */
function getProduct(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Product id must be a non-empty string');
  const product = products.get(id);
  if (!product) throw new TypeError('Product not found');
  return product;
}

/** @description List all products from the store */
function listProducts() {
  return Array.from(products.values());
}

/** @description Update an existing product in the store */
function updateProduct(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Product id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('Product data must be an object');
  if (!products.has(id)) throw new TypeError('Product not found');
  const product = products.get(id);
  const updated = { ...product, ...data, id };
  products.set(id, updated);
  return updated;
}

/** @description Delete a product from the store */
function deleteProduct(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Product id must be a non-empty string');
  if (!products.has(id)) throw new TypeError('Product not found');
  products.delete(id);
}

// Order CRUD functions
/** @description Create a new order in the store */
function createOrder(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Order id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('Order data must be an object');
  if (orders.has(id)) throw new TypeError('Order with this id already exists');
  orders.set(id, { id, ...data });
  return orders.get(id);
}

/** @description Retrieve an order by id from the store */
function getOrder(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Order id must be a non-empty string');
  const order = orders.get(id);
  if (!order) throw new TypeError('Order not found');
  return order;
}

/** @description List all orders from the store */
function listOrders() {
  return Array.from(orders.values());
}

/** @description Update an existing order in the store */
function updateOrder(id, data) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Order id must be a non-empty string');
  if (!data || typeof data !== 'object') throw new TypeError('Order data must be an object');
  if (!orders.has(id)) throw new TypeError('Order not found');
  const order = orders.get(id);
  const updated = { ...order, ...data, id };
  orders.set(id, updated);
  return updated;
}

/** @description Delete an order from the store */
function deleteOrder(id) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('Order id must be a non-empty string');
  if (!orders.has(id)) throw new TypeError('Order not found');
  orders.delete(id);
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
  deleteOrder
};
