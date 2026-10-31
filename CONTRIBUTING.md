# Contributing

Use Node 24, pinned in `.nvmrc`, and npm. With nvm installed:

```sh
nvm install
nvm use
npm ci
npx playwright install --with-deps chromium
npm run dev
```

The dev server is at http://localhost:5173. On Linux, Playwright's browser dependencies may require administrator access.

## Checks

Run every check before submitting a change:

```sh
npm test
npm run typecheck
npm run check
npm run e2e
```

`npm test` runs the codec and model tests with Vitest. `npm run typecheck` runs TypeScript; `npm run check` checks Svelte components too.
`npm run e2e` runs Playwright against the production site on port 5179 by default.
Local runs build before starting the preview server; an already running server on the selected port is reused.
If port 5179 is busy, use the optional override `E2E_PORT=5279 npm run e2e`.
CI builds once in its own step before Playwright and retains traces and an HTML report on failure.
For manual inspection, `npm run build` generates the production site, service worker and third-party licence notices,
rejecting missing or disallowed licences; `npm run preview` serves it.

## Saves and privacy

Tests use synthetic saves built from the published schema. Optional real-save tests skip when their fixtures are absent; that is expected on a clean checkout.
The optional fixture files are `slot_0.mp`, `meta_0.mp`, `slot_10.mp`, `meta_10.mp`, `slot_0.json`, `slot_1.json` and `meta_0.json`.
Keep them only in `tests/saves/`, which is git-ignored. These are personal saves and must never be committed.
Never paste their contents into issues or PRs, or include their names in screenshots, test expectations or documentation.
Use synthetic data for regression tests. If a bug needs a real save, ask the maintainer for a private sharing method and wait for instructions.
If the editor offers a scrubbed-copy export, inspect it before sharing. An ordinary export is not a scrubbed copy.

The production page's meta CSP restricts page resource origins. It does not apply to the service worker or Workbox;
those need a response CSP header ([#222](https://github.com/AuthFailed/cotl-save-editor/issues/222)).
Request-audit tests check the open, edit and export flow for uploads.

## Translations

English UI strings live in `src/i18n/en.ts`; the other 14 locale files are beside it.
Add or change each string in all 15 locales, keeping the same key and placeholders such as `{name}` and `{n}`.
Plural strings use objects with an `other` form and the language's additional plural forms.
Use `t()` for UI text. `tests/i18n.test.ts` checks matching keys and placeholders; `npm run check` also checks typed keys in Svelte.
Game names, descriptions and pictures come from api.cotl.info; keep UI strings in the editor's locale files.

## Commits and pull requests

Keep changes focused. Use an imperative, sentence-case subject with no prefix and end it with the issue number, for example:
`Pin the Node version and keep Playwright traces (#233)`.
Do not add trailers. Fill in the PR checklist and include screenshots for UI changes, using synthetic data.

[Report a bug or request a feature](https://github.com/AuthFailed/cotl-save-editor/issues/new/choose).
