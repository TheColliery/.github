// Store module - in-memory REST-style CRUD operations for users, products, orders

const users = new Map();
const products = new Map();
const orders = new Map();

let userIdCounter = 1;
let productIdCounter = 1;
let orderIdCounter = 1;

// ============================================================================
// USERS
// ============================================================================

/** Create a new user with the given name and email. */
function createUser(name, email) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('name must be a non-empty string');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw new TypeError('email must be a non-empty string');
  }
  const id = userIdCounter++;
  const user = { id, name, email };
  users.set(id, user);
  return user;
}

/** Retrieve a user by ID. */
function getUser(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const user = users.get(id);
  if (!user) {
    throw new TypeError(`user with id ${id} not found`);
  }
  return user;
}

/** Retrieve all users. */
function listUsers() {
  return Array.from(users.values());
}

/** Update an existing user with new name and/or email. */
function updateUser(id, name, email) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const user = users.get(id);
  if (!user) {
    throw new TypeError(`user with id ${id} not found`);
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('name must be a non-empty string');
    }
    user.name = name;
  }
  if (email !== undefined) {
    if (typeof email !== 'string' || !email.trim()) {
      throw new TypeError('email must be a non-empty string');
    }
    user.email = email;
  }
  return user;
}

/** Delete a user by ID. */
function deleteUser(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const user = users.get(id);
  if (!user) {
    throw new TypeError(`user with id ${id} not found`);
  }
  users.delete(id);
  return user;
}

// ============================================================================
// PRODUCTS
// ============================================================================

/** Create a new product with the given name and price. */
function createProduct(name, price) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('name must be a non-empty string');
  }
  if (typeof price !== 'number' || price < 0) {
    throw new TypeError('price must be a non-negative number');
  }
  const id = productIdCounter++;
  const product = { id, name, price };
  products.set(id, product);
  return product;
}

/** Retrieve a product by ID. */
function getProduct(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const product = products.get(id);
  if (!product) {
    throw new TypeError(`product with id ${id} not found`);
  }
  return product;
}

/** Retrieve all products. */
function listProducts() {
  return Array.from(products.values());
}

/** Update an existing product with new name and/or price. */
function updateProduct(id, name, price) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const product = products.get(id);
  if (!product) {
    throw new TypeError(`product with id ${id} not found`);
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('name must be a non-empty string');
    }
    product.name = name;
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || price < 0) {
      throw new TypeError('price must be a non-negative number');
    }
    product.price = price;
  }
  return product;
}

/** Delete a product by ID. */
function deleteProduct(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const product = products.get(id);
  if (!product) {
    throw new TypeError(`product with id ${id} not found`);
  }
  products.delete(id);
  return product;
}

// ============================================================================
// ORDERS
// ============================================================================

/** Create a new order with the given user ID and product ID. */
function createOrder(userId, productId) {
  if (typeof userId !== 'number' || userId < 1) {
    throw new TypeError('userId must be a positive number');
  }
  if (typeof productId !== 'number' || productId < 1) {
    throw new TypeError('productId must be a positive number');
  }
  if (!users.has(userId)) {
    throw new TypeError(`user with id ${userId} not found`);
  }
  if (!products.has(productId)) {
    throw new TypeError(`product with id ${productId} not found`);
  }
  const id = orderIdCounter++;
  const order = { id, userId, productId };
  orders.set(id, order);
  return order;
}

/** Retrieve an order by ID. */
function getOrder(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const order = orders.get(id);
  if (!order) {
    throw new TypeError(`order with id ${id} not found`);
  }
  return order;
}

/** Retrieve all orders. */
function listOrders() {
  return Array.from(orders.values());
}

/** Update an existing order with new user ID and/or product ID. */
function updateOrder(id, userId, productId) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const order = orders.get(id);
  if (!order) {
    throw new TypeError(`order with id ${id} not found`);
  }
  if (userId !== undefined) {
    if (typeof userId !== 'number' || userId < 1) {
      throw new TypeError('userId must be a positive number');
    }
    if (!users.has(userId)) {
      throw new TypeError(`user with id ${userId} not found`);
    }
    order.userId = userId;
  }
  if (productId !== undefined) {
    if (typeof productId !== 'number' || productId < 1) {
      throw new TypeError('productId must be a positive number');
    }
    if (!products.has(productId)) {
      throw new TypeError(`product with id ${productId} not found`);
    }
    order.productId = productId;
  }
  return order;
}

/** Delete an order by ID. */
function deleteOrder(id) {
  if (typeof id !== 'number' || id < 1) {
    throw new TypeError('id must be a positive number');
  }
  const order = orders.get(id);
  if (!order) {
    throw new TypeError(`order with id ${id} not found`);
  }
  orders.delete(id);
  return order;
}

// ============================================================================
// EXPORTS
// ============================================================================

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
