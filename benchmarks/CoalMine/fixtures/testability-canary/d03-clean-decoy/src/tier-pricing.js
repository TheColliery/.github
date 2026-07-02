const TIERS = Object.freeze({
  basic: 9,
  pro: 29,
  enterprise: 99
});

function priceFor(tier, seats) {
  if (!(tier in TIERS)) {
    throw new RangeError('unknown tier: ' + tier);
  }
  return TIERS[tier] * seats;
}

module.exports = { priceFor };
