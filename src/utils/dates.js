// Hub Contract Rule 6: dates are ISO 8601 UTC without milliseconds.
function toIsoUtc(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { toIsoUtc };
