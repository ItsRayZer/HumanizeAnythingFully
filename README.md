# HumanizeAnythingFully

Humanize any text, PDF, or document without changing its topic, structure, format, design, or images. Free forever.

## What it does

Give it any text or PDF and it returns a humanized version:

- Every sentence rewritten fully, in a natural human voice, not just the flagged ones
- Topic, structure, format, design, images, fonts, colours, layout, margins, and page size stay exactly the same as the original, only the prose wording changes
- Verified until no online detector can flag it: ZeroGPT under 15 percent, plagiarism 0 to 1 percent
- Built-in AI and plagiarism detection that finds flagged sentences and fixes them, with ZeroGPT and the Turnitin detector as the outside confirmation checks
- Front matter pages (index, declaration, certificate, acknowledgement, lists), headlines, and subheadlines are never changed, only the body prose underneath them is rewritten
- Works with any PDF and any text

## How it works

The skill is a full workflow, not a single prompt:

1. Take in any text, PDF, or document and measure the original layout first
2. Rewrite the prose sentence by sentence, writing for the two signals detectors measure: perplexity (unpredictable word choices) and burstiness (wildly varying sentence lengths)
3. Drive plagiarism to 0 to 1 percent by structurally rebuilding every matched sentence, so no run of 7 words survives in the same order
4. Rebuild the PDF in the exact original format, with contents and list numbers fixed from the real pagination
5. Verify with ZeroGPT, the Turnitin detector, and a plagiarism check, fix flagged sentences one by one, and re-run every detector after each round

## Use it

This is an agent skill. Copy the `SKILL.md` and `skill.yaml` into your agent's skills directory and it loads as the `humanize-anything-fully` skill. It pairs with a `humanizer` skill for the rewrite itself and an `ai-detector` skill for the detector logic.

## Use it with your agent

It is packaged for Claude, ChatGPT, Gemini, and other agents. See `INSTALL.md` for the exact steps per platform.

- Claude Code and Claude app: install as a plugin from `.claude-plugin/`, or copy the skill into your skills directory
- ChatGPT: paste `chatgpt-instructions.md` into a custom GPT and upload `SKILL.md` as knowledge
- Gemini: use `GEMINI.md` for a Gem, or install `gemini-extension.json` in Gemini CLI
- Codex, Cursor, VS Code Copilot: copy the skill into the agent skills folder, see `INSTALL.md`
- Any MCP client: run the server in `mcp-server/`, it exposes `humanize_text`, `check_text`, `detect_ai`, and `detect_plagiarism` tools over stdio, free with your own free LLM key

## Free website + API

No install needed. Paste text on the site and get the same structure back with only the prose rewritten, plus a local detector estimate.

- Website: `website/` in this repo, deployed on Vercel (live URL in `humanize-website/BUILD.md` in the builder workspace; the short form is `<name>.vercel.app`)
- API: `POST /api/humanize` with `{ text, mode, key }`, `POST /api/detect` with `{ text }`, `GET /api/health`
- Bring your own free NVIDIA key (from build.nvidia.com) or use the site key when the owner has set it. A pasted key is sent only with that one request, never stored or logged.
- Limits: 5,000 characters per humanize request, 10 humanize calls per hour per address
- Detector scores on the site are local heuristic estimates, not ZeroGPT or Turnitin. No plagiarism percentage is shown: the local checker cannot run on serverless, and no fake number is ever shown.
- Phase 1 is text only. PDF upload arrives in Phase 2.

## Proven results

- M.Tech project report, "AI Based Autonomous Drone for Disaster Monitoring": ZeroGPT 58.7 percent down to 2.1 percent, plagiarism 0 percent, format and front matter identical to the original
- Class 12 Chemistry project, "Detection of Chalk Powder in Turmeric": plagiarism 0 percent

## Honest limits

No method guarantees that no detector can ever flag a text. Simple factual writing, like school definitions, floors ZeroGPT near 55 to 60 percent across five rewrite passes, because definitions are statistically predictable no matter how they are phrased. The skill reports measured scores honestly and never claims a clean score proves authorship.

Rewrite for clarity and natural voice only. Never use this skill to disguise who wrote graded or academic work.

## License

MIT. See LICENSE.
