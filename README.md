# kaleid

A minimal terminal coding agent. kaleid signs in to OpenAI through your ChatGPT
account (Codex OAuth), gives the model `read` / `write` / `edit` / `bash` tools,
and runs an agent loop inside a small [Ink](https://github.com/vadimdemedes/ink)
TUI — hand it a task in your terminal and watch it work.

## Features

- Sign in with your ChatGPT account (Codex OAuth) — no API key required
- Built-in tools: `read`, `write`, `edit`, `bash`
- Interactive REPL with slash commands, plus a one-shot mode for scripts
- Single global install, default model `gpt-5.5`

## Quick Start

Requires Node.js >= 22.

```bash
npm i -g kaleid
kaleid            # start the interactive REPL
```

Inside the REPL, type `/` to see the command menu:

| Command | Description |
|---------|-------------|
| `/login`  | Sign in with your ChatGPT account (opens the browser) |
| `/logout` | Sign out |
| `/help`   | List commands |
| `/exit`   | Quit |

Anything that doesn't start with `/` is sent to the agent.

One-shot (non-interactive):

```bash
kaleid "read package.json and summarize the scripts"
```

Override the model for a run with `--model <id>`. Credentials are stored only on
your machine at `~/.kaleid/auth.json`.

## Disclaimer

kaleid uses ChatGPT OAuth for OpenAI Codex access and is subject to OpenAI's
policies and your account terms. It does not bundle API keys, ChatGPT
credentials, or subscription access.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

All rights reserved (UNLICENSED). You may install and use the published CLI; the
source is not licensed for redistribution or modification.
