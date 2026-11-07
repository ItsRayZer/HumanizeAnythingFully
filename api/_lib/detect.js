// Local AI-likeness heuristic, ported from the repo's MCP server
// (mcp-server/server.js, detect_ai). Same signals, same scoring, same
// verdicts, so the website estimate matches the skill's own tool.
// It is a heuristic estimate from surface signals only. It is NOT ZeroGPT
// and NOT Turnitin. Never present it as either.

const BANNED_WORDS = [
  "delve", "delves", "moreover", "furthermore", "additionally",
  "in conclusion", "crucial", "seamless", "landscape", "testament",
  "unlock", "game-changer", "navigate", "tapestry", "showcase",
  "leverage", "pivotal", "robust", "comprehensive",
  "underscore", "underscores",
];

const STOCK_PHRASES = [
  "it is important to note",
  "in today's fast-paced world",
  "a testament to",
  "it is worth noting",
  "in summary",
  "in the ever-evolving landscape",
  "let's dive in",
  "great question",
  "i hope this helps",
];

function splitSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+["')\]]*/g);
  if (!matches) return text.trim() ? [text.trim()] : [];
  const sentences = matches.map((s) => s.trim()).filter(Boolean);
  const consumed = matches.join("").length;
  const rest = text.slice(consumed).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

function countWords(sentence) {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function openingOf(sentence) {
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 3).join(" ");
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Rhythm + size stats for any passage (used by /api/humanize too).
function measureStats(text) {
  const sentences = splitSentences(text);
  const lengths = sentences.map(countWords);
  const m = mean(lengths);
  const sd = stdDev(lengths);
  const words = lengths.reduce((a, b) => a + b, 0);
  const under6 = lengths.filter((n) => n < 6).length;
  const over30 = lengths.filter((n) => n > 30).length;
  return {
    words,
    sentences: sentences.length,
    mean: Math.round(m * 10) / 10,
    sd: Math.round(sd * 10) / 10,
    cv: m ? Math.round((sd / m) * 100) / 100 : 0,
    range: lengths.length ? Math.max(...lengths) - Math.min(...lengths) : 0,
    under6Pct: lengths.length ? Math.round((under6 / lengths.length) * 1000) / 10 : 0,
    over30Pct: lengths.length ? Math.round((over30 / lengths.length) * 1000) / 10 : 0,
  };
}

function detect(text) {
  const sentences = splitSentences(text);
  const lengths = sentences.map(countWords);
  const meanLen = mean(lengths);
  const sdLen = stdDev(lengths);
  const burstinessCV = meanLen ? Math.round((sdLen / meanLen) * 100) / 100 : 0;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => countWords(p))
    .filter((n) => n > 0);
  const paraCV =
    paragraphs.length >= 3
      ? Math.round((stdDev(paragraphs) / mean(paragraphs)) * 100) / 100
      : null;

  const stockFound = [];
  const sentenceStock = sentences.map(() => []);
  for (const word of BANNED_WORDS) {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    let count = 0;
    sentences.forEach((s, i) => {
      const hits = s.match(re);
      if (hits) {
        count += hits.length;
        sentenceStock[i].push(`stock phrase: "${word}"`);
      }
    });
    if (count) stockFound.push({ phrase: word, count });
  }
  for (const phrase of STOCK_PHRASES) {
    const re = new RegExp(escapeRegExp(phrase), "gi");
    let count = 0;
    sentences.forEach((s, i) => {
      const hits = s.match(re);
      if (hits) {
        count += hits.length;
        sentenceStock[i].push(`stock phrase: "${phrase}"`);
      }
    });
    if (count) stockFound.push({ phrase, count });
  }
  const stockTotal = stockFound.reduce((a, b) => a + b.count, 0);

  const openingCounts = new Map();
  const openings = sentences.map(openingOf);
  for (const o of openings) {
    if (o) openingCounts.set(o, (openingCounts.get(o) || 0) + 1);
  }
  const repeatedOpenings = [...openingCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([opening, count]) => ({ opening, count }))
    .sort((a, b) => b.count - a.count);
  const sentenceOpening = sentences.map((_, i) => {
    const count = openingCounts.get(openings[i]) || 0;
    return count >= 3
      ? `repeated opening: "${openings[i]}" (used ${count} times)`
      : null;
  });

  const inUniformRun = new Set();
  let runStart = 0;
  for (let i = 1; i <= lengths.length; i++) {
    const continues =
      i < lengths.length && Math.abs(lengths[i] - lengths[runStart]) <= 3;
    if (!continues) {
      if (i - runStart >= 3) {
        for (let j = runStart; j < i; j++) inUniformRun.add(j);
      }
      runStart = i;
    }
  }

  // Score, 0 to 100, higher means more AI-like. Each signal is capped.
  let score = 0;
  if (burstinessCV < 0.35) score += 30;
  else if (burstinessCV < 0.5) score += 20;
  else if (burstinessCV < 0.65) score += 10;
  else if (burstinessCV < 0.8) score += 5;
  score += Math.min(25, stockTotal * 4);
  let openingPoints = 0;
  for (const { count } of repeatedOpenings) openingPoints += (count - 2) * 5;
  score += Math.min(20, openingPoints);
  if (paraCV !== null) {
    if (paraCV < 0.4) score += 15;
    else if (paraCV < 0.6) score += 7;
  }
  score = Math.min(100, score);

  const verdict =
    sentences.length < 5
      ? "unreliable, too few sentences to judge"
      : score < 30
        ? "likely human"
        : score <= 60
          ? "mixed"
          : "likely AI";

  const flaggedSentences = [];
  sentences.forEach((sentence, i) => {
    const reasons = [...sentenceStock[i]];
    if (sentenceOpening[i]) reasons.push(sentenceOpening[i]);
    if (inUniformRun.has(i)) {
      reasons.push("part of a uniform-length run of 3 or more sentences");
    }
    if (reasons.length) flaggedSentences.push({ sentence, reasons });
  });

  return {
    detector: "local heuristic estimate, not ZeroGPT or Turnitin",
    score,
    verdict: `${verdict} (heuristic estimate)`,
    sentenceCount: sentences.length,
    meanSentenceLengthWords: Math.round(meanLen * 10) / 10,
    sentenceLengthStdDev: Math.round(sdLen * 10) / 10,
    burstinessCV,
    paragraphCount: paragraphs.length,
    paragraphLengthCV: paraCV,
    stockPhrasesFound: stockFound,
    stockTotal,
    repeatedOpenings,
    flaggedSentences,
    note:
      sentences.length < 5
        ? "Too few sentences for a reliable burstiness reading. Scores on very short text are unreliable."
        : "A heuristic estimate from surface signals only. Confirm with ZeroGPT or Turnitin before reporting a score.",
  };
}

module.exports = { BANNED_WORDS, STOCK_PHRASES, splitSentences, countWords, mean, stdDev, measureStats, detect };
