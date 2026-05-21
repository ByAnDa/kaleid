# kaleid

kaleid is a terminal coding harness agent. It provides an OpenAI Codex OAuth
provider, read/write/edit/bash tools, an agent loop, and a small Ink TUI.

## Install

```bash
npm i -g kaleid
```

## Login

```bash
kaleid login
```

Use your own ChatGPT account to complete the browser OAuth flow. Credentials are
stored only on your machine at `~/.kaleid/auth.json`.

## Usage

```bash
kaleid
kaleid "read package.json and summarize the scripts"
kaleid -p "read package.json and summarize the scripts"
```

The default model is `gpt-5.5`. Use `--model <id>` to override it for a run.

## Disclaimer

kaleid uses ChatGPT OAuth for OpenAI Codex access and is subject to the
applicable OpenAI policies and account terms. It is not bundled with API keys,
ChatGPT credentials, or subscription access.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```
