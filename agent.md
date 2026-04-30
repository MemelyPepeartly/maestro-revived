# Agent Guide for Maestro (Foundry VTT)

## Project Overview
- Maestro Revived is a Foundry VTT module targeting core v14 (`module.json` compatibility minimum and verified `14.360`).
- Source entrypoint: `src/maestro.ts`.
- Runtime build output entrypoint: `dist/maestro.js`.
- Feature logic is split under `src/modules/`.
- Styles live in `maestro.css`.
- Localization files live in `lang/*.json`.
- Manifest and release metadata live in `module.json`.

## Working Rules
- Make focused, minimal changes tied to the requested task.
- Use Foundry v14-compatible hooks and public application APIs.
- Follow the existing TypeScript style in this repo.
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
- Behavior and hooks: `src/maestro.ts`
- Feature modules: `src/modules/*.ts`
- Manifest/compatibility: `module.json`
- Changelog: `CHANGELOG.md`
