const metrics = require('./metrics');

async function capturePayment(req, amount, token) {
  const res = await fetch('http://payments.internal/capture', {
    method: 'POST',
    headers: { 'content-type': 'application/json', traceparent: req.headers.traceparent },
    body: JSON.stringify({ amount, token }),
  });
  metrics.increment('payments.capture', { ok: res.ok });
  if (!res.ok) {
    throw new Error('payment capture failed: ' + res.status);
  }
  return res.json();
}

module.exports = { capturePayment };
