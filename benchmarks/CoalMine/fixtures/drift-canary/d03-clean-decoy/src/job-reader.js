function decodeJob(raw) {
  const data = JSON.parse(raw);
  return {
    id: data.jobId !== undefined ? data.jobId : data.job_id,
    runAt: data.runAt !== undefined ? data.runAt : data.run_at
  };
}

module.exports = { decodeJob };
