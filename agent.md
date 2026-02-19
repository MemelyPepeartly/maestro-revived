# Agent Guide for Maestro (Foundry VTT)

## Project Overview
- Maestro is a Foundry VTT module targeting core v13 (`module.json` compatibility minimum `13`, verified `13.346`).
- Source entrypoint: `src/maestro.ts`.
- Runtime build output entrypoint: `dist/maestro.js`.
- Feature logic is split under `src/modules/`.
- Styles live in `maestro.css`.
- Localization files live in `lang/*.json`.
- Manifest and release metadata live in `module.json`.

## Working Rules
- Make focused, minimal changes tied to the requested task.
- Preserve Foundry v13 compatibility unless explicitly asked to migrate APIs.
- Follow the existing plain JavaScript style in this repo.
- Avoid adding new tooling or dependencies unless required for the task.
- If adding or changing user-facing text, update localization keys in `lang/en.json` and keep other language files aligned when possible.

## Validation
- Install dependencies: `npm install`.
- Build TypeScript output: `npm run build`.
- Run type checks: `npm test`.
- For manifest-related edits, ensure `module.json` remains valid JSON and required keys are intact.

## Release Notes
- GitHub Actions auto-release reads version from `module.json`.
- When preparing a release, update `module.json.version` and keep `package.json.version` in sync when appropriate.
- Do not commit generated archives unless explicitly requested.

## High-Impact Files
- Behavior and hooks: `maestro.js`
- Feature modules: `modules/*.js`
- Manifest/compatibility: `module.json`
- Changelog: `CHANGELOG.md`
