function decodeEvent(raw) {
  const data = JSON.parse(raw);
  return {
    id: data.eventId,
    createdAt: data.created_at,
    payload: data.payload
  };
}

module.exports = { decodeEvent };
