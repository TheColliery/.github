class ReceiptService {
  constructor(store, mailer) {
    this.store = store;
    this.mailer = mailer;
  }

  async send(orderId) {
    const order = await this.store.find(orderId);
    await this.mailer.deliver(order.email, 'Receipt for ' + orderId);
    return order.total;
  }
}

module.exports = { ReceiptService };
