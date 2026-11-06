#!/usr/bin/env node
// HumanizeAnythingFully MCP server.
// Tools: humanize_text (needs a free LLM key), check_text (local checks only),
// detect_ai (local heuristic estimate, no LLM), detect_plagiarism (local free checker client).
// No key, no fake output: humanize_text returns an error when no key is set.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

const BANNED_WORDS = [
  "delve", "moreover", "furthermore", "additionally", "in conclusion",
  "crucial", "seamless", "landscape", "testament", "unlock", "game-changer",
  "navigate", "tapestry", "showcase", "leverage", "pivotal", "robust",
  "comprehensive",
];

// Stock AI phrases from the ai-detector skill, checked as whole phrases.
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

const DEFAULT_CHECKER_URL = "http://localhost:5000";
const CHECKER_START_HELP =
  "Start it with: cd ~/workspace/free-turnitin-checker && npm start (run npm run build in that folder first if you have never built it).";

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

// Split long text into chunks at sentence boundaries, for the plagiarism
// checker, which takes at most 60 phrases per call.
function chunkText(text, maxChars = 8000) {
  const chunks = [];
  let current = "";
  for (const sentence of splitSentences(text)) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars));
      }
      continue;
    }
    if (current && current.length + sentence.length + 1 > maxChars) {
      chunks.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const REWRITE_SYSTEM_PROMPT = [
  "You rewrite text in a natural human voice, following the HumanizeAnythingFully skill.",
  "Rewrite every sentence fully, not only the flagged ones. A sentence counts as rewritten only when its structure changed, not when a few words were swapped.",
  "Use unpredictable word choices, wildly varying sentence lengths, short fragments next to long winding sentences, contractions, And/But/So openers, questions, parenthetical asides, and concrete specifics.",
  "Cut stock AI phrases: delve, moreover, furthermore, additionally, in conclusion, crucial, seamless, landscape, testament, unlock, game-changer, navigate, tapestry, showcase, leverage, pivotal, robust, comprehensive.",
  "Never use an em dash, use commas or hyphens instead.",
  "Keep every fact, number, date, citation, heading, section number, table cell value, figure caption, and bibliography entry identical in meaning. Keep the topic, structure, and headings exactly the same. Keep the word count within 10 percent of the original.",
  "For simple factual text, use the personal voice lever: first person where the document allows it, concrete personal details, the writer's own lab or work story, specific places and moments.",
  "Return only the rewritten text, no preamble and no explanation.",
].join(" ");

const server = new McpServer({
  name: "humanize-anything-fully",
  version: "1.0.0",
});

server.tool(
  "humanize_text",
  "Rewrite text in a natural human voice per the HumanizeAnythingFully skill. Needs an LLM key in HUMANIZE_LLM_API_KEY; returns an error, not fake output, when no key is set.",
  {
    text: z.string().describe("The text to humanize."),
    model: z.string().optional().describe("Model id. Default is nvidia/nemotron-3-ultra-550b-a55b."),
  },
  async ({ text, model }) => {
    const apiKey = process.env.HUMANIZE_LLM_API_KEY;
    if (!apiKey) {
      return {
        content: [
          {
            type: "text",
            text: "ERROR: no LLM key configured. Set HUMANIZE_LLM_API_KEY to a free key (for example from build.nvidia.com) and try again. This tool never fakes output.",
          },
        ],
        isError: true,
      };
    }
    const baseUrl = (process.env.HUMANIZE_LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    const chosenModel = model || process.env.HUMANIZE_LLM_MODEL || DEFAULT_MODEL;
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: chosenModel,
          messages: [
            { role: "system", content: REWRITE_SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
          temperature: 0.7,
        }),
      });
    } catch (error) {
      return {
        content: [{ type: "text", text: `ERROR: could not reach the LLM endpoint: ${error.message}` }],
        isError: true,
      };
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        content: [{ type: "text", text: `ERROR: LLM endpoint returned HTTP ${response.status}: ${detail.slice(0, 500)}` }],
        isError: true,
      };
    }
    const data = await response.json();
    const rewritten = data?.choices?.[0]?.message?.content;
    if (typeof rewritten !== "string" || rewritten.trim() === "") {
      return {
        content: [{ type: "text", text: "ERROR: LLM endpoint returned no text." }],
        isError: true,
      };
    }
    return { content: [{ type: "text", text: rewritten }] };
  },
);

server.tool(
  "check_text",
  "Run local checks on text, no LLM involved: em dash count, banned stock words found, word count, citation numbers found, and section headings found.",
  {
    text: z.string().describe("The text to check."),
  },
  async ({ text }) => {
    const emDashCount = (text.match(/\u2014/g) || []).length;
    const foundBanned = [];
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(text)) foundBanned.push(word);
    }
    const words = text.split(/\s+/).filter(Boolean);
    const citations = [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    const headings = text
      .split("\n")
      .filter((line) => /^#{1,6}\s+/.test(line.trim()))
      .map((line) => line.trim());
    const result = {
      emDashCount,
      bannedWordsFound: foundBanned,
      bannedWordsCount: foundBanned.length,
      wordCount: words.length,
      citationsFound: citations,
      headingsFound: headings,
      pass: emDashCount === 0 && foundBanned.length === 0,
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "detect_ai",
  "Estimate how AI-like a text reads, using local heuristics only, no LLM, no network, no API key. This is a heuristic estimate based on the ai-detector skill signals (burstiness, stock phrases, repeated sentence openings, uniform paragraph length). It is NOT a ZeroGPT or GPTZero score. Returns a 0-100 score and the flagged sentences with reasons.",
  {
    text: z.string().describe("The text to estimate."),
  },
  async ({ text }) => {
    if (!text || !text.trim()) {
      return { content: [{ type: "text", text: "ERROR: no text given." }], isError: true };
    }
    const sentences = splitSentences(text);
    const lengths = sentences.map(countWords);
    const meanLen = mean(lengths);
    const sdLen = stdDev(lengths);
    const burstinessCV = meanLen ? Math.round((sdLen / meanLen) * 100) / 100 : 0;

    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => countWords(p))
      .filter((n) => n > 0);
    const paraCV = paragraphs.length >= 3 ? Math.round((stdDev(paragraphs) / mean(paragraphs)) * 100) / 100 : null;

    // Stock phrase hits, per sentence and total.
    const stockFound = [];
    const sentenceStock = sentences.map(() => []);
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
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
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
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

    // Repeated sentence openings (first 3 words).
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
      return count >= 3 ? `repeated opening: "${openings[i]}" (used ${count} times)` : null;
    });

    // Runs of 3 or more consecutive sentences with near-identical length.
    const inUniformRun = new Set();
    let runStart = 0;
    for (let i = 1; i <= lengths.length; i++) {
      const continues = i < lengths.length && Math.abs(lengths[i] - lengths[runStart]) <= 3;
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

    const result = {
      detector: "local heuristic estimate, not ZeroGPT or GPTZero",
      score,
      verdict: `${verdict} (heuristic estimate)`,
      sentenceCount: sentences.length,
      meanSentenceLengthWords: Math.round(meanLen * 10) / 10,
      sentenceLengthStdDev: Math.round(sdLen * 10) / 10,
      burstinessCV,
      paragraphCount: paragraphs.length,
      paragraphLengthCV: paraCV,
      stockPhrasesFound: stockFound,
      repeatedOpenings,
      flaggedSentences,
      note:
        sentences.length < 5
          ? "Too few sentences for a reliable burstiness reading. Scores on very short text are unreliable."
          : "A heuristic estimate from surface signals only. Confirm with ZeroGPT and GPTZero before reporting a score.",
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "detect_plagiarism",
  "Check text for plagiarism with the local free plagiarism checker (public web pages only, not Turnitin). Matches runs of 7 or more words. Returns similarity percent, matched words, and every matched source. Returns an error, not fake output, when the checker is not running.",
  {
    text: z.string().describe("The text to check for plagiarism."),
    excludeQuotes: z.boolean().optional().describe("Exclude quoted passages from the comparison. Default false."),
  },
  async ({ text, excludeQuotes }) => {
    if (!text || !text.trim()) {
      return { content: [{ type: "text", text: "ERROR: no text given." }], isError: true };
    }
    const checkerUrl = (process.env.PLAGIARISM_CHECKER_URL || DEFAULT_CHECKER_URL).replace(/\/$/, "");
    const chunks = chunkText(text);
    let matchedWords = 0;
    let countedWords = 0;
    let segmentsSearched = 0;
    let segmentsTotal = 0;
    let segmentsNotSearched = 0;
    const sourcesByUrl = new Map();
    const spans = [];
    const warnings = new Set();
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      let response;
      try {
        response = await fetch(`${checkerUrl}/api/plagiarism-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[chunkIndex], excludeQuotes: Boolean(excludeQuotes) }),
          signal: AbortSignal.timeout(180000),
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: could not reach the local plagiarism checker at ${checkerUrl}. ${CHECKER_START_HELP}`,
            },
          ],
          isError: true,
        };
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          content: [
            { type: "text", text: `ERROR: plagiarism checker returned HTTP ${response.status}: ${detail.slice(0, 500)}` },
          ],
          isError: true,
        };
      }
      const data = await response.json();
      matchedWords += data?.similarity?.matchedWords || 0;
      countedWords += data?.similarity?.countedWords || 0;
      segmentsSearched += data?.coverage?.segmentsSearched || 0;
      segmentsTotal += data?.coverage?.segmentsTotal || 0;
      segmentsNotSearched += data?.coverage?.segmentsNotSearched || 0;
      for (const s of data?.sources || []) {
        if (!sourcesByUrl.has(s.url)) {
          sourcesByUrl.set(s.url, { url: s.url, host: s.host, title: s.title, matchedWords: 0, spanCount: 0 });
        }
        const agg = sourcesByUrl.get(s.url);
        agg.matchedWords += s.matchedWords || 0;
        agg.spanCount += s.spanCount || 0;
      }
      for (const sp of data?.spans || []) {
        const source = (data?.sources || []).find((s) => s.id === sp.sourceId);
        spans.push({
          chunkIndex,
          start: sp.start,
          end: sp.end,
          words: sp.words,
          sourceId: sp.sourceId,
          sourceUrl: source ? source.url : null,
        });
      }
      for (const n of data?.notes || []) {
        if (n.level === "warning") warnings.add(n.text);
      }
    }
    const similarityPercent = countedWords ? Math.round((matchedWords / countedWords) * 1000) / 10 : 0;
    const result = {
      checker: "local free plagiarism checker (public web pages only, not Turnitin)",
      similarityPercent,
      matchedWords,
      countedWords,
      chunks: chunks.length,
      sources: [...sourcesByUrl.values()].sort((a, b) => b.matchedWords - a.matchedWords),
      spans,
      coverage: { segmentsSearched, segmentsTotal, segmentsNotSearched },
      warnings: [...warnings],
      note: "Span positions are relative to their chunk. A 0 percent here means no public page matched, not a clean bill from Turnitin itself.",
    };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
