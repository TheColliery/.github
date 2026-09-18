// Wire format v2 (camelCase). v1 (snake_case) is still readable via fallback.
function encodeJob(job) {
  return JSON.stringify({ jobId: job.id, runAt: job.runAt });
}

module.exports = { encodeJob };
