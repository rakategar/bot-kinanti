// src/services/logger.js
// NlpLog table removed from database - this is now a no-op
// Kept for backward compatibility in case it's imported somewhere

async function logNlp({ userPhone, text, predicted, confidence, entities }) {
  // No-op: NlpLog table no longer exists in database
}

module.exports = { logNlp };
