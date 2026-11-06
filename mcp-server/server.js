#!/usr/bin/env node
// HumanizeAnythingFully MCP server.
// Tools: humanize_text (needs a free LLM key) and check_text (local checks only).
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

const transport = new StdioServerTransport();
await server.connect(transport);
