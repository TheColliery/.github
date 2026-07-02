function weekendSurcharge(subtotal) {
  const day = new Date().getDay();
  if (day === 0 || day === 6) {
    return subtotal * 0.05;
  }
  return 0;
}

function totalWithSurcharge(subtotal) {
  return subtotal + weekendSurcharge(subtotal);
}

module.exports = { weekendSurcharge, totalWithSurcharge };
