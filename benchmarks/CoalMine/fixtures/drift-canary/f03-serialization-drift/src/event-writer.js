// Wire format v2 (camelCase) - the writer DEFINES the event payload.
function encodeEvent(event) {
  return JSON.stringify({
    eventId: event.id,
    createdAt: event.createdAt,
    payload: event.payload
  });
}

module.exports = { encodeEvent };
