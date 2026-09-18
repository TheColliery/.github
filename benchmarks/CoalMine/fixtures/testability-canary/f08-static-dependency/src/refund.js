class AuditLog {
  entries = [];
  static getInstance() {
    if (!AuditLog.instance) AuditLog.instance = new AuditLog();
    return AuditLog.instance;
  }
  record(msg) {
    this.entries.push(msg);
  }
}
function applyRefund(balance, amount) {
  AuditLog.getInstance().record('refund ' + amount);
  return balance - amount;
}
module.exports = { applyRefund, AuditLog };
