// Expands the shipping matrix: carriers x speed tiers.
// Both lists are fixed product config — three entries each.
const CARRIERS = ['ups', 'fedex', 'dhl'];
const TIERS = ['ground', 'express', 'overnight'];

function shippingOptions() {
  const options = [];
  for (const carrier of CARRIERS) {
    for (const tier of TIERS) {
      options.push({ carrier, tier, code: carrier + ':' + tier });
    }
  }
  return options;
}

module.exports = { shippingOptions };
