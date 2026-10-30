# Contributing

Thanks for wanting to improve Eisenhower Post-its. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/phzmedeiros/eisenhower-postits/issues) with:

- What you did, what you expected and what happened instead.
- Your Obsidian version, operating system, and whether it happens on desktop or mobile.
- The matrix note in raw Markdown, if the problem is related to its content. Remove anything private first.

## Suggesting a feature

Open an issue describing the problem you want to solve before writing code. It helps to agree on the approach first.

## Development setup

1. Clone the repository into the plugins folder of a test vault: `<vault>/.obsidian/plugins/eisenhower-postits/`.
2. Install dependencies with `npm install`.
3. Run `npm run dev` to rebuild `main.js` on every change.
4. Enable **Eisenhower Post-its** in **Settings → Community plugins** and reload Obsidian after each build.

`npm run build` type-checks the code and creates a production build, and `npm run lint` runs the official Obsidian ESLint rules. Run both before opening a pull request.

## Code style

- TypeScript in `src/`, one responsibility per file: `board.ts` for the Markdown format and the board model, `view.ts` for the matrix view, `main.ts` for commands and events.
- Use the Obsidian API (`createEl`, `setIcon`, `Menu`, `Modal`) instead of raw DOM or `innerHTML`.
- Keep user-facing text in `src/i18n.ts`, in English and Portuguese, using sentence case.
- Keep styles in `styles.css`, scoped under `.eisenhower-postits`, and use Obsidian CSS variables so light and dark themes keep working.

## Pull requests

- Keep each pull request focused on one change.
- Describe what changed and how you tested it, on desktop and, if relevant, on mobile.
- Do not bump the version; releases are handled by the maintainer.
