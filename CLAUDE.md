# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Chrome extension (Manifest V3, **vanilla JS — no build step, no dependencies, no tests**) that marks YouTube videos the user has rated (Like/Dislike) — or optionally watched past a threshold — with a "✓ Viewed" badge on thumbnails across YouTube.

## Commands

```bash
npm run package    # builds dist/youtube-check-v<version>.zip for the Chrome Web Store
```

There is no build, lint, or test tooling. To develop: load the repo root as an unpacked extension at `chrome://extensions`, then hit the reload button after edits (content-script changes also need a YouTube tab reload).

`scripts/package-extension.sh` reads the version straight from `manifest.json` and zips only `manifest.json`, `icons/`, `src/`, `_locales/`.

## Release flow

Version lives in **three** places that must stay in sync: `manifest.json`, `package.json`, and a new `CHANGELOG.md` entry (Keep a Changelog format, written in PT-BR). Store listing copy lives in `docs/chrome-web-store.md`; the privacy policy is `store/privacy-policy.html`, published at https://brunolagoa.github.io/youtube-check/store/privacy-policy.html.

## Architecture

No modules/imports in the content-script layer — files are concatenated by the manifest's `content_scripts.js` array **in load order**, each exposing a single global IIFE namespace. Order matters: `messages.js` → `i18n.js` → `storage.js` → `youtube-parser.js` → `dom-observer.js` → `content.js`. A new shared util must be added to that array in the right slot.

Globals:

- **`YTCheckMessages`** (`src/i18n/messages.js`) — the real UI string catalog for `en` / `pt-BR`. `_locales/*/messages.json` only holds `extName` for the manifest; do **not** grow it, add strings to `messages.js` instead.
- **`YTCheckI18n`** (`src/i18n/i18n.js`) — `t(key, sub)`, plus `applyDOM(root)` which translates any element carrying `data-i18n` attributes. HTML pages (popup/options/welcome) are written with `data-i18n` markers and localized at runtime.
- **`YTCheckStorage`** (`src/storage/storage.js`) — the *only* place that touches `chrome.storage`. Video records go to `storage.local` under a single `videos` object keyed by videoId; settings go to `storage.sync` under `settings`. Every call is wrapped in `safeStorage()` + `isContextValid()` because YouTube SPA navigation regularly orphans the content script after an extension reload — never call `chrome.storage.*` directly from content code.
- **`YTParser`** (`src/utils/youtube-parser.js`) — all YouTube-DOM knowledge is quarantined here: the list of thumbnail container tags (`VIDEO_ELEMENT_TAGS` / `VIDEO_ELEMENTS_SELECTOR`), Shorts player selectors, videoId extraction from every URL shape, and `detectLikeDislikeState()` (reads `aria-pressed` / `is-toggled` and matches aria-labels in EN **and** PT). When YouTube ships a new card component (as it did with `yt-lockup-view-model` in 1.4.1), the fix belongs in this file's selector lists.
- **`YTDomObserver`** (`src/utils/dom-observer.js`) — debounced (200ms) MutationObserver for infinite scroll, plus `watchNavigation()` which monkey-patches `history.pushState`/`replaceState` and listens for `popstate` to catch YouTube's SPA route changes (there is no page load to hook).
- **`src/content/content.js`** (~1250 lines) — the orchestrator. Handles page-change routing, like/dislike detection on watch pages, a separate Shorts subsystem (reel-in-viewport detection, URL polling, click capture, per-session counters), the opt-in watch-progress timer, badge/overlay application, and the draggable on-page counter.

**Background** (`src/background/service-worker.js`) is deliberately thin: opens the welcome tab on install, runs a daily `chrome.alarms` job that prunes videos older than `historyRetentionDays` (0 = keep forever), and serves `refreshAllTabs` / `exportData` messages.

**Messaging** is a flat `{ type }` switch. Content script accepts `refresh`, `getStats`, `clearHistory`, `settingsChanged`, `ping`; the service worker accepts `refreshAllTabs`, `exportData`. Popup/options mostly bypass messaging and read storage directly, relying on `chrome.storage.onChanged` in the content script for live updates.

## Conventions

- Settings are added to `DEFAULT_SETTINGS` in `storage.js` and validated/clamped in `normalizeSettings()` (see `watchProgressThreshold`, which is snapped to the `WATCH_PROGRESS_THRESHOLDS` set) — storage may hold stale values from older versions, so always defend there rather than at the call site.
- `badgeText` is locale-derived: an empty or previously-default value is re-resolved to the current locale's default, so never persist the literal default string as if it were user input.
- Code, comments and JSDoc are in English; CHANGELOG, `docs/`, and shell-script output are in PT-BR. README exists in both (`README.md` / `README.pt-BR.md`) — update both.
- New user-facing behavior generally needs: catalog strings in `messages.js` (both locales), an options-page control, a CHANGELOG entry, and often a `docs/chrome-web-store.md` copy update.
