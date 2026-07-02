function processOrder(rawJson) {
  const order = JSON.parse(rawJson);
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.qty;
  }
  if (order.coupon === 'SAVE10') {
    total *= 0.9;
  }
  return '<div class="receipt">' + order.id + ': $' + total.toFixed(2) + '</div>';
}

module.exports = { processOrder };
