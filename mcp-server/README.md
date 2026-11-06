# HumanizeAnythingFully MCP server

A small Node.js MCP server with four tools. It uses the official `@modelcontextprotocol/sdk` over stdio, and has no paid dependencies.

## Tools

- `humanize_text`: rewrites text in a human voice per the HumanizeAnythingFully skill. It calls an OpenAI compatible LLM endpoint. It needs a key, and returns an error instead of fake output when no key is set.
- `check_text`: local checks only, no LLM, no network. Returns the em dash count, the banned stock words found, the word count, the citation numbers found, and the section headings found.
- `detect_ai`: estimates how AI-like a text reads, using local heuristics only, no LLM, no network, no key. It measures sentence length mean and variance (burstiness), stock AI phrases, repeated sentence openings, and uniform paragraph length, and returns a 0-100 score plus the flagged sentences with reasons. This is a heuristic estimate, not a ZeroGPT or GPTZero score. Confirm with ZeroGPT and GPTZero before reporting a score.
- `detect_plagiarism`: checks text for plagiarism with the local free plagiarism checker (public web pages only, not Turnitin). It matches runs of 7 or more words and returns the similarity percent, the matched words, and every matched source. It splits long text into chunks, since the checker takes at most 60 phrases per call. It returns an error, not fake output, when the checker is not running.

## The detect, fix, re-detect loop

1. Rewrite with `humanize_text`.
2. Run `detect_ai` and `detect_plagiarism` on the rewritten text.
3. Rewrite every flagged sentence structurally: change the word order, split it, change voice, start from a different point, or add a short human aside. A synonym swap alone does not fix a flagged sentence.
4. Re-run both detectors after each round of fixes, and repeat until no sentence is flagged by either one.
5. Only then rebuild the PDF. Confirm the final scores on ZeroGPT and GPTZero as well.

## Start the plagiarism checker

`detect_plagiarism` needs the local checker running on port 5000. Build it once, then start it:

```bash
cd ~/workspace/free-turnitin-checker
npm run build
npm start
```

The checker serves `POST /api/plagiarism-check` on `http://localhost:5000`. Leave it running while you use `detect_plagiarism`. To point the tool at a different checker URL, set `PLAGIARISM_CHECKER_URL` in the environment.

## Run it

```bash
cd mcp-server
npm install
npm start
```

The server speaks MCP over stdio, so you run it through an MCP client, not directly in a browser.

## Point it at a free LLM key

`humanize_text` reads these environment variables:

- `HUMANIZE_LLM_API_KEY`: your LLM key. No key means the tool errors out. Get a free key at build.nvidia.com (sign in, create an API key). No payment needed.
- `HUMANIZE_LLM_BASE_URL`: the endpoint base URL. Default is `https://integrate.api.nvidia.com/v1`, the NVIDIA free API.
- `HUMANIZE_LLM_MODEL`: the model id. Default is `nvidia/nemotron-3-ultra-550b-a55b`.

Example:

```bash
export HUMANIZE_LLM_API_KEY="nvapi-..."
export HUMANIZE_LLM_BASE_URL="https://integrate.api.nvidia.com/v1"
npm start
```

You can also point it at any other OpenAI compatible endpoint by changing the base URL and model. The key stays in your environment, never in a file.

## Add it to an MCP client

Generic MCP client config (stdio):

```json
{
  "mcpServers": {
    "humanize-anything-fully": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/server.js"],
      "env": {
        "HUMANIZE_LLM_BASE_URL": "https://integrate.api.nvidia.com/v1",
        "HUMANIZE_LLM_API_KEY": "nvapi-..."
      }
    }
  }
}
```

Replace the path with the real path on your machine. Keep your key out of shared files.

## Test it

Test `check_text` end to end without a key:

```bash
cd mcp-server
npm install
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"check_text","arguments":{"text":"Hello world, this is a test. Moreover it has an em dash here."}}}' | node server.js
```

`humanize_text` is untested without a live key. To test it, set `HUMANIZE_LLM_API_KEY` and call it the same way with `{"name": "humanize_text", "arguments": {"text": "Your text here."}}`.

Test `detect_ai` the same way, no key needed:

```bash
cd mcp-server
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"detect_ai","arguments":{"text":"Moreover, it is important to note that the system is robust. Moreover, it is important to note that the system is seamless. Moreover, it is important to note that the system is comprehensive."}}}' | node server.js
```

Test `detect_plagiarism` the same way, with the checker running on port 5000 first (see above):

```bash
cd mcp-server
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"detect_plagiarism","arguments":{"text":"Your text here."}}}' | node server.js
```
