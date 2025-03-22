# Obsidian Toggl Track Contribution Plugin

This is a plugin for Obsidian (https://obsidian.md).

This project was developed from the sample plugin (https://github.com/obsidianmd/obsidian-sample-plugin). It uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

This plugin visualizes your Toggl Track data in a contribution graph style calendar.
![alt text](image.png)

## How to use

### Development

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

### Installation

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/toggl-contribution-plugin/`.

### Configuration

1. Go to plugin settings and enter your Toggl API token and workspace ID
2. Use the `toggl-graph` code block in your notes to display the contribution graph