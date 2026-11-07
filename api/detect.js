// POST /api/detect — local heuristic estimate of how AI-like a text reads.
// No LLM, no network, no key. Body: { text }.
// The number is a heuristic estimate from surface signals only. It is NOT
// ZeroGPT and NOT Turnitin. Never present it as either.

const { detect, measureStats } = require("./_lib/detect");
const { checkLimit, clientIp } = require("./_lib/limit");

const MAX_CHARS = 20000;
const DETECT_PER_MINUTE = 30;

function send(res, status, obj) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.json(obj);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });
  }

  const body = readBody(req);
  const text = typeof body.text === "string" ? body.text : "";

  if (!text.trim()) {
    return send(res, 400, { error: "EMPTY_TEXT", message: "Paste some text first." });
  }
  if (text.length > MAX_CHARS) {
    return send(res, 400, {
      error: "TEXT_TOO_LONG",
      message: `Text is ${text.length} characters; the detect limit per request is ${MAX_CHARS}.`,
    });
  }

  const ip = clientIp(req);
  const limit = checkLimit(`detect:${ip}`, DETECT_PER_MINUTE, 60 * 1000);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return send(res, 429, {
      error: "RATE_LIMITED",
      message: "Too many checks from this address. Try again in a moment.",
      retryAfter: limit.retryAfter,
    });
  }

  const result = detect(text);
  const stats = measureStats(text);
  return send(res, 200, {
    estimate: result.score,
    verdict: result.verdict,
    cv: result.burstinessCV,
    sd: result.sentenceLengthStdDev,
    mean: result.meanSentenceLengthWords,
    sentenceCount: result.sentenceCount,
    paragraphCount: result.paragraphCount,
    paragraphLengthCV: result.paragraphLengthCV,
    stockWords: result.stockPhrasesFound,
    repeatedOpenings: result.repeatedOpenings,
    flaggedSentences: result.flaggedSentences,
    stats,
    note: result.note,
  });
};
