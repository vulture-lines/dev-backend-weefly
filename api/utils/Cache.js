const NodeCache = require("node-cache");

// TTL = 86400 seconds = 24 hours
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

module.exports = cache;
