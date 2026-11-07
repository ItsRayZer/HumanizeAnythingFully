// POST /api/humanize — rewrite text in a natural human voice, keeping the
// structure and format exactly the same. Only the body prose is rewritten.
//
// Body: { text, mode?: "default" | "personal", key?: "<own free NVIDIA key>" }
// The key is used for this one request only. It is never stored or logged.
// If no key is sent, the server uses NVIDIA_API_KEY when the site owner
// has set it in Vercel. No key anywhere means an honest error, never
// fake output.

const { detect, measureStats } = require("./_lib/detect");
const { checkLimit, clientIp } = require("./_lib/limit");

// Default model, measured 2026-11-08: google/gemma-4-31b-it returns a full
// rewrite of a ~150-word passage in ~11s with detector estimate 28 -> 20,
// CV 0.35 -> 0.49, stock words 2 -> 0, structure intact.
// The skill's pinned model (nvidia/nemotron-3-ultra-550b-a55b) is a
// reasoning model: it spends ~3000-3700 tokens reasoning before answering,
// so even a 3-sentence rewrite takes ~35s and a 150-word rewrite ~72s,
// past the serverless time limit. It stays the MCP server default (no time
// cap there). The website uses the fast model so a stranger's paste works.
const MODEL = "google/gemma-4-31b-it";
const BASE_URL = "https://integrate.api.nvidia.com/v1";
const MAX_CHARS = 5000;
const HUMANIZE_PER_HOUR = 10;
const LLM_TIMEOUT_MS = 55000;

const BANNED_LIST =
  "delve, moreover, furthermore, additionally, in conclusion, crucial, seamless, landscape, testament, unlock, game-changer, navigate, tapestry, showcase, leverage, pivotal, robust, comprehensive, underscores";

const SYSTEM_PROMPT = [
  "You rewrite text in a natural human voice, following the HumanizeAnythingFully skill.",
  "Rewrite EVERY sentence fully, not only some of them. A sentence counts as rewritten only when its structure changed, not when a few words were swapped. Change the word order, split long sentences, merge short ones, start from a different point, use contractions, And/But/So openers, questions, and short parenthetical asides.",
  "STRUCTURE AND FORMAT STAY EXACTLY THE SAME. Keep every heading, subheading, list, table, figure caption, section number, and paragraph break exactly where it is, in the same order. Headings and subheadings are NEVER reworded, not even one word. Only the body prose underneath a heading gets rewritten. Keep all Markdown formatting (headings, bold, italics, lists, code, links) intact.",
  "Keep every fact, number, date, citation, quotation, name, table cell value, and bibliography entry identical in meaning. Never add facts, evidence, sources, or claims that are not in the original. Never invent a specific detail. Keep the word count within 10 percent of the original.",
  "Write for rhythm, not correctness alone. Vary sentence lengths wildly: short fragments next to long winding sentences. Aim for sentence-length variation (standard deviation divided by mean) above 0.45, ideally 0.55, with standard deviation above 7 words and a range above 30 words. About 4 to 8 percent of sentences should be under 6 words, and about a quarter over 30 words.",
  "Cut stock AI words and phrases wherever they appear: " + BANNED_LIST + ". Use plain verbs instead. Ration connectors: at most 1 in 5 paragraph openings may use a stock connector, and prefer no connector at all. Break lists of three parallel items: split them, reorder them, or fold one item into the sentence.",
  "Never use an em dash anywhere in the output. Use commas or hyphens instead.",
  "Return ONLY the rewritten text. No preamble, no explanation, no notes, no quotation marks around the result.",
].join(" ");

const PERSONAL_LEVER =
  " For simple factual text, use the personal voice lever: first person where the text allows it, concrete personal details, the writer's own lab or work story, specific places and moments from the text itself. Never invent new specifics.";

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

async function callModel(apiKey, system, userText, maxTokens) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
  } catch (err) {
    const e = new Error("MODEL_UNREACHABLE");
    e.cause = err;
    throw e;
  }
  if (!response.ok) {
    const err = new Error("MODEL_ERROR");
    err.status = response.status;
    try {
      err.detail = (await response.json()).message || "";
    } catch {
      err.detail = "";
    }
    throw err;
  }
  const data = await response.json();
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
  return String(content || "").trim();
}

// The model sometimes adds a short preamble despite the instruction.
// Strip a leading preamble line only when the rest of the text remains.
function stripPreamble(text) {
  const lines = text.split("\n");
  if (lines.length < 2) return text;
  const first = lines[0].trim();
  if (
    /^(here(’|')s|below is|here is|rewritten( text| version)?[:\s]|sure[,.!]?|of course[,.!]?)/i.test(
      first
    ) &&
    first.length < 120
  ) {
    return lines.slice(1).join("\n").trimStart();
  }
  return text;
}

function cleanOutput(text) {
  let out = stripPreamble(text);
  // Safety net for the no-em-dash rule: an em dash that slips through
  // becomes a comma, never a silent pass-through.
  out = out.replace(/\s*—\s*/g, ", ").replace(/—/g, "-");
  return out.trim();
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "METHOD_NOT_ALLOWED", message: "Use POST." });
  }

  const body = readBody(req);
  const text = typeof body.text === "string" ? body.text : "";
  const mode = body.mode === "personal" ? "personal" : "default";
  const byokKey = typeof body.key === "string" ? body.key.trim() : "";

  if (!text.trim()) {
    return send(res, 400, {
      error: "EMPTY_TEXT",
      message: "Paste some text first.",
    });
  }
  if (text.length > MAX_CHARS) {
    return send(res, 400, {
      error: "TEXT_TOO_LONG",
      message: `Text is ${text.length} characters; the limit per request is ${MAX_CHARS}. Split it into smaller parts and send them one at a time.`,
    });
  }

  const ip = clientIp(req);
  const limit = checkLimit(`humanize:${ip}`, HUMANIZE_PER_HOUR, 60 * 60 * 1000);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return send(res, 429, {
      error: "RATE_LIMITED",
      message: `Too many requests from this address. Try again in about ${Math.ceil(
        limit.retryAfter / 60
      )} minute(s).`,
      retryAfter: limit.retryAfter,
    });
  }

  const apiKey = byokKey || process.env.NVIDIA_API_KEY || "";
  if (!apiKey) {
    return send(res, 400, {
      error: "KEY_REQUIRED",
      message:
        "No rewrite key is set on this site yet. Paste your own free NVIDIA key (from build.nvidia.com) in the key box and try again. The key is sent only with this one request and is never stored.",
    });
  }

  const system =
    SYSTEM_PROMPT + (mode === "personal" ? PERSONAL_LEVER : "");
  const maxTokens = 2048;

  let rewritten;
  try {
    rewritten = await callModel(apiKey, system, text, maxTokens);
  } catch (err) {
    if (err.message === "MODEL_UNREACHABLE") {
      return send(res, 502, {
        error: "MODEL_UNREACHABLE",
        message:
          "Could not reach the rewrite model. Check your connection and try again, or try your own key.",
      });
    }
    if (err.status === 404) {
      return send(res, 502, {
        error: "MODEL_NOT_AVAILABLE",
        message:
          "The rewrite model is not available for this key (HTTP 404). A free NVIDIA key only covers the models enabled for that account; try a key with the default model enabled, or wait for the site key.",
      });
    }
    if (err.status === 401 || err.status === 403) {
      return send(res, 502, {
        error: "KEY_REJECTED",
        message:
          "The rewrite model rejected the key. If you pasted your own key, check it is a full free key from build.nvidia.com. If the site key is set, the owner needs to replace it.",
      });
    }
    if (err.status === 429) {
      return send(res, 429, {
        error: "MODEL_RATE_LIMITED",
        message:
          "The rewrite model is rate limited right now. Wait a minute and try again, or use your own free key.",
        retryAfter: 60,
      });
    }
    return send(res, 502, {
      error: "MODEL_ERROR",
      message: `The rewrite model returned an error (HTTP ${err.status || "?"}). Try again in a moment.`,
    });
  }

  if (!rewritten) {
    return send(res, 502, {
      error: "EMPTY_RESPONSE",
      message: "The rewrite model returned nothing. Try again.",
    });
  }

  let passes = 1;
  let best = cleanOutput(rewritten);
  let bestDetect = detect(best);

  // Detect-fix-redetect loop, max 2 passes (skill rule: a third pass
  // shuffles flags without lowering the score).
  if (bestDetect.score >= 50 || bestDetect.stockTotal > 0) {
    const flagged = bestDetect.flaggedSentences
      .slice(0, 8)
      .map((f) => `- ${f.sentence}`)
      .join("\n");
    const pass2User =
      "Rewrite the text below again in a natural human voice. These sentences still read as AI-written, so rebuild each of them structurally (new words AND new structure, split or merge them, start from a different point). Keep every heading, fact, number, date, and citation identical in meaning, keep the structure exactly the same, and never use an em dash. Return only the rewritten text.\n\nFlagged sentences:\n" +
      flagged +
      "\n\nText:\n" +
      best;
    try {
      const second = await callModel(apiKey, system, pass2User, maxTokens);
      if (second) {
        const secondClean = cleanOutput(second);
        const secondDetect = detect(secondClean);
        passes = 2;
        if (secondDetect.score < bestDetect.score) {
          best = secondClean;
          bestDetect = secondDetect;
        }
      }
    } catch {
      // A failed second pass never loses the first pass. Report honestly.
    }
  }

  const stats = measureStats(best);
  const originalStats = measureStats(text);
  return send(res, 200, {
    rewritten: best,
    stats,
    originalStats,
    detector: {
      estimate: bestDetect.score,
      verdict: bestDetect.verdict,
      cv: bestDetect.burstinessCV,
      sd: bestDetect.sentenceLengthStdDev,
      flagged: bestDetect.flaggedSentences,
      stockWords: bestDetect.stockPhrasesFound,
      note: bestDetect.note,
    },
    passes,
    model: MODEL,
  });
};
