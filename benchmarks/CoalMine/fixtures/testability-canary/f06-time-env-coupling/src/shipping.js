function shippingCost(weightKg) {
  const region = process.env.SHIP_REGION || 'US';
  const rates = { US: 5, EU: 9, APAC: 12 };
  return (rates[region] || rates.US) + weightKg * 0.8;
}

function labelFor(cost) {
  return 'Shipping: $' + cost.toFixed(2);
}

module.exports = { shippingCost, labelFor };
