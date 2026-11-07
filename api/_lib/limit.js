// Per-IP rate limiting, in-memory only. Serverless instances are
// ephemeral, so this is best-effort abuse protection, not a hard quota.
// No IP, key, or text is ever logged or persisted.

const buckets = new Map(); // key -> array of epoch-ms timestamps

function prune(list, windowMs, now) {
  while (list.length && list[0] <= now - windowMs) list.shift();
}

function checkLimit(key, limit, windowMs) {
  const now = Date.now();
  let list = buckets.get(key);
  if (!list) {
    list = [];
    buckets.set(key, list);
  }
  prune(list, windowMs, now);
  if (list.length >= limit) {
    const retryAfter = Math.ceil((list[0] + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
  }
  list.push(now);
  // Keep the map from growing without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      prune(v, windowMs, now);
      if (!v.length) buckets.delete(k);
      if (buckets.size <= 4000) break;
    }
  }
  return { allowed: true, remaining: limit - list.length, retryAfter: 0 };
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { checkLimit, clientIp };
