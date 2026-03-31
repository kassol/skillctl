# skills-tui

A terminal UI for managing global AI agent skills.

## Features

- Three-column Miller Columns layout for intuitive navigation
- Marketplace browser (skills.sh) to discover and install skills
- Multi-agent management (Claude Code, Codex, Cursor, Gemini CLI, and more)
- Enable/disable skills per agent via symlinks
- Responsive layout that adapts to terminal size

## Installation

### Homebrew

```bash
brew tap kassol/tap && brew install skills-tui
```

### Direct binary download

Download the latest release from the [releases page](https://github.com/kassol/skills-tui/releases) and place the binary in your `$PATH`.

### From source

```bash
git clone https://github.com/kassol/skills-tui
cd skills-tui
bun install
bun run build
```

## Usage

```
skills-tui [--version]
```

### Keyboard shortcuts

| Key   | Action                              |
|-------|-------------------------------------|
| Tab   | Move focus between columns          |
| j / k | Navigate up/down in list            |
| /     | Open search overlay                 |
| a     | Add skill / repo                    |
| d / e | Disable / enable for current agent  |
| D / E | Disable / enable for all agents     |
| x     | Remove skill                        |
| u     | Sync / update repo                  |
| q     | Quit                                |

## Requirements

- Node.js >= 18 — required for `npx skills` subprocess calls (add/sync/remove operations)

## Development

```bash
bun install        # install dependencies
bun run dev        # run in development mode
bun run test       # run tests (vitest)
bun run lint       # check code quality (Biome)
```

## License

MIT
