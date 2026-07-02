const fs = require('fs');

function computePayout(sales, commissionRate) {
  let payout = 0;
  for (const sale of sales) {
    payout += sale.amount * commissionRate;
  }
  fs.appendFileSync('/var/log/payout-audit.log', payout + '\n');
  return payout;
}

module.exports = { computePayout };
