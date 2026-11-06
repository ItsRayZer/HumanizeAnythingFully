# HumanizeAnythingFully MCP server

A small Node.js MCP server with two tools. It uses the official `@modelcontextprotocol/sdk` over stdio, and has no paid dependencies.

## Tools

- `humanize_text`: rewrites text in a human voice per the HumanizeAnythingFully skill. It calls an OpenAI compatible LLM endpoint. It needs a key, and returns an error instead of fake output when no key is set.
- `check_text`: local checks only, no LLM, no network. Returns the em dash count, the banned stock words found, the word count, the citation numbers found, and the section headings found.

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
