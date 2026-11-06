# Install HumanizeAnythingFully

Repo: `https://github.com/ItsRayZer/HumanizeAnythingFully`

One skill, every platform. The skill file is the same everywhere: `SKILL.md`. Two copies live in this repo. The copy at the repo root is the plain skill. The copy at `skills/humanize-anything-fully/SKILL.md` is the same text with YAML frontmatter (`name` and `description`) added on top, which is what the open Agent Skills format requires. Use the `skills/` copy whenever a platform reads `SKILL.md` from a folder.

There is no store listing and no one-click install for this skill. Every method below is a real one, checked against the platform's own docs. Steps marked "you do this" need your own action, account, or key.

## Claude Code (plugin, recommended)

Install the plugin from this repo as a marketplace. In Claude Code, run:

```
/plugin marketplace add ItsRayZer/HumanizeAnythingFully
/plugin install humanize-anything-fully@humanize-anything-fully
```

Restart Claude Code after installing. The skill then loads as `/humanize-anything-fully:humanize-anything-fully`.

Manual install instead, no marketplace. You do this:

```bash
mkdir -p ~/.claude/skills/humanize-anything-fully
curl -fsSL https://raw.githubusercontent.com/ItsRayZer/HumanizeAnythingFully/main/skills/humanize-anything-fully/SKILL.md -o ~/.claude/skills/humanize-anything-fully/SKILL.md
```

Restart Claude Code. For one project only, put the same folder under `.claude/skills/` in that project instead of `~/.claude/skills/`.

## Claude app (Desktop and web)

The Claude app does not read `~/.claude/skills/`. You do this:

1. Download this repo as a zip, or copy the `skills/humanize-anything-fully/` folder to your computer.
2. Zip that folder so `SKILL.md` sits at the root of the zip, not nested under extra folders.
3. Open Claude, go to Settings, then Skills (under Features or Customize).
4. Upload the zip.

Skills you upload this way are yours alone and do not sync to Claude Code. Install it in each place separately. Skill upload in the Claude app is a paid-plan feature; the guide I checked lists Pro, Max, Team, and Enterprise with file creation enabled. That plan detail was not re-verified against Anthropic's live docs in this task.

## ChatGPT (custom GPT)

You do this, and you need a ChatGPT Plus account to create a custom GPT. That Plus requirement was not re-verified against OpenAI's live docs in this task.

1. In ChatGPT, open Explore GPTs, then Create a GPT.
2. Paste the whole of `chatgpt-instructions.md` from this repo into the Instructions box.
3. Under Knowledge, upload `SKILL.md` from this repo.
4. Save the GPT and use it by pasting text or uploading a PDF.

## Gemini (Gem in the app, and Gemini CLI)

### Gem in the Gemini app

You do this:

1. Open the Gemini app, go to Gems, then New Gem.
2. Paste the contents of `GEMINI.md` from this repo as the Gem instructions.
3. Save the Gem and use it by pasting text or uploading a file.

### Gemini CLI (extension)

You need `git` installed on your machine. Run this outside the CLI interactive mode, in your terminal:

```bash
gemini extensions install https://github.com/ItsRayZer/HumanizeAnythingFully
```

This copies the extension, including the `GEMINI.md` context, the skill, and the MCP server. Then set your free LLM key. You do this:

```bash
gemini extensions config humanize-anything-fully
```

Enter your key when asked. Get a free key at build.nvidia.com (sign in, create an API key, no payment). Restart your Gemini CLI session after installing or changing settings. Update later with `gemini extensions update humanize-anything-fully`.

## Codex (CLI, IDE extension, ChatGPT app)

Copy the skill folder. You do this:

```bash
mkdir -p ~/.agents/skills/humanize-anything-fully
cp skills/humanize-anything-fully/SKILL.md ~/.agents/skills/humanize-anything-fully/SKILL.md
```

Use the `skills/` copy, not the repo root `SKILL.md`, because Codex reads the `name` and `description` from the frontmatter. For one repo only, put the folder under `.agents/skills/` in that repo instead. Codex also still reads the older `~/.codex/skills/` folder. Run it with `$humanize-anything-fully` or pick it from `/skills`. Codex loads the skill when your task matches its description.

## Cursor

Copy the skill folder. You do this:

```bash
mkdir -p ~/.cursor/skills/humanize-anything-fully
cp skills/humanize-anything-fully/SKILL.md ~/.cursor/skills/humanize-anything-fully/SKILL.md
```

Use the `skills/` copy, because Cursor requires the `name` in `SKILL.md` to match the folder name. For one project only, put the folder under `.cursor/skills/` in that project. The shared `~/.agents/skills/` folder also works in Cursor and Codex at the same time. Start a new Cursor chat, check Customize, then Skills, and run it with `/humanize-anything-fully` or `@humanize-anything-fully`.

## VS Code Copilot

Copy the skill folder into your workspace. You do this:

```bash
mkdir -p .github/skills/humanize-anything-fully
cp skills/humanize-anything-fully/SKILL.md .github/skills/humanize-anything-fully/SKILL.md
```

Use the `skills/` copy, because Copilot reads `name` and `description` from the frontmatter. For a personal skill instead, put the folder under `~/.copilot/skills/`. Make sure the `github.copilot.chat.skillTool.enabled` setting is on. Skills work through Copilot agent mode, which needs a Copilot subscription; that subscription detail was not re-verified against Microsoft's live docs in this task. Type `/skills` in Copilot chat to see it.

## Any generic MCP client

Add the bundled MCP server with a stdio config. You do this, and you need your own free LLM key for the rewrite tool:

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

Replace the path with the real path on your machine. Keep your key out of shared files. See `mcp-server/README.md` for the full run instructions. `check_text` works with no key. `humanize_text` returns an error, not fake output, when no key is set.

## What I did not verify live

- The ChatGPT Plus requirement for creating a custom GPT.
- The Claude app plan requirement for skill upload.
- The Copilot subscription requirement for agent mode.

Everything else above was checked against the platform's own docs or this repo's own files. Nothing here is a store listing or a one-click install that does not exist.
