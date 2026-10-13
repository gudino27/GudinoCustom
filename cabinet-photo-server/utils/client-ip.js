// CLIENT IP
//
// The visitor's IP for rate limiting and the city lookup.
// Cloudflare sets CF-Connecting-IP and overwrites any value the visitor sends,
// so it is used when it is a valid IP. Otherwise the socket address.
// Never req.ip: with 'trust proxy' true it is the left-most X-Forwarded-For,
// which the visitor controls.
// Never log the value.

const net = require('net');

let loggedHeaderPresence = false;

function clientIp(req) {
  const header = req.headers['cf-connecting-ip'];
  const cf = typeof header === 'string' ? header.trim() : '';
  if (!loggedHeaderPresence) {
    loggedHeaderPresence = true;
    // Presence only, never the value (checked once on live, see Task 9)
    console.log(`cf-connecting-ip present: ${cf !== ''}`);
  }
  if (cf && net.isIP(cf)) return cf;
  return (req.socket && req.socket.remoteAddress) || '';
}

module.exports = { clientIp };
