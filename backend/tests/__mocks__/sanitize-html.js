/**
 * Passthrough stub for sanitize-html in unit tests.
 *
 * The real package pulls in htmlparser2, whose current build ships ESM
 * that jest (no babel transform configured here) cannot parse. None of
 * these unit tests exercise sanitization behavior, so a passthrough that
 * returns the input string unchanged is sufficient and keeps the handler
 * tests from loading the ESM dependency chain.
 */
module.exports = function sanitizeHtml(input) {
  return input;
};
