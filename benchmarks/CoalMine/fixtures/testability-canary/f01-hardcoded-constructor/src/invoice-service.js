class TaxRateTable {
  rateFor(region) {
    return region === 'EU' ? 0.21 : 0.07;
  }
}
class InvoiceService {
  constructor() {
    this.rates = new TaxRateTable();
  }
  total(amount, region) {
    return amount * (1 + this.rates.rateFor(region));
  }
}
module.exports = { InvoiceService };
