# kaleid

ByAnDa 自用的终端 Harness Agent（编码 agent）。

- 产品需求：`docs/kaleid-prd-v0.3.md`
- 技术 spec：`specs/kaleid-v1-spec.md`

clean-room 自研（TypeScript + Node）。V1 = OpenAI Codex OAuth provider + read/write/edit/bash 四工具 + agent loop + 简单 TUI(ink) + npm 打包。

## Usage

```bash
npm install
npm run build
npm i -g .

kaleid login
kaleid
kaleid "read package.json and summarize the scripts"
```

Useful commands:

```bash
npm run typecheck
npm test
npm run build
```
