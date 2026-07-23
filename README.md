# kaleid

A minimal terminal coding agent. kaleid connects to OpenAI Codex through your
ChatGPT account, or to DeepSeek and Kimi with your API key. It gives the model
`read`, `write`, `edit`, and `bash` tools, then runs an agent loop in a compact
[Ink](https://github.com/vadimdemedes/ink) TUI.

## Features

- OpenAI Codex OAuth, DeepSeek, and Kimi providers
- Built-in read/write/edit/bash tools
- Interactive full-screen TUI and one-shot mode
- Model and reasoning selectors
- Persistent JSONL sessions, resume, context usage, and compaction
- Conversation names, projects, labels, and resume filters
- Daylight/Spectrum themes and keyboard-driven tool/result panels

## Quick Start

Requires Node.js >= 22.

```bash
npm i -g kaleid
kaleid
```

Inside the TUI, type `/` to see the command menu:

| Command | Description |
|---|---|
| `/login` | Sign in to a provider |
| `/logout` | Remove provider credentials |
| `/model` | Select the current model |
| `/reasoning` | Select Codex reasoning effort |
| `/compact` | Compact conversation context |
| `/resume` | Resume a saved session |
| `/rename` | Rename the current conversation |
| `/project` | Set the conversation project |
| `/chatlabel` | Add or remove conversation labels |
| `/theme` | Switch TUI theme |
| `/help` | Show commands |
| `/exit` | Quit |

One-shot mode:

```bash
kaleid "read package.json and summarize the scripts"
kaleid -p "run the tests and explain any failure"
```

Resume a session:

```bash
kaleid --continue
kaleid --resume
kaleid --resume <session-id>
```

Override the model with `--model <id>`.

## Local Data

kaleid stores credentials and sessions only on your machine:

- `~/.kaleid/auth.json` — OpenAI Codex OAuth
- `~/.kaleid/config.json` — DeepSeek/Kimi API keys
- `~/.kaleid/sessions/*.jsonl` — saved conversations

Do not commit or share these files.

## Disclaimer

kaleid's provider integrations are subject to each provider's policies and your
account terms. The package does not bundle API keys, ChatGPT credentials, or
subscription access.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Project handover and canonical product documentation live in
`docs/handover/` and `docs/prd/`.

## License

All rights reserved (UNLICENSED). You may install and use the published CLI; the
source is not licensed for redistribution or modification.
