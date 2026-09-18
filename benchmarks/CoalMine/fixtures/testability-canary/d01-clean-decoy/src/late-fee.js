const DAY_MS = 24 * 60 * 60 * 1000;

function lateFee(dueDate, now, dailyRate) {
  const overdueMs = now.getTime() - dueDate.getTime();
  if (overdueMs <= 0) {
    return 0;
  }
  const days = Math.ceil(overdueMs / DAY_MS);
  return days * dailyRate;
}

module.exports = { lateFee };
