# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**YouTube Check** — a Manifest V3 Chrome extension (vanilla JS, no framework, no bundler) that marks YouTube videos you've rated (Like/Dislike) or watched-to-completion with a "✓ Viewed" badge on thumbnails across the platform.

## Commands

There is **no build step and no test suite**. `src/` is loaded directly as the extension — `manifest.json` references `src/...` paths as-is.

- **Load / develop:** `chrome://extensions` → enable Developer mode → **Load unpacked** → select the repo root. After editing any file, click the reload icon on the extension card, then **F5** the YouTube tab.
- **Package for the store:** `npm run package` (or `./scripts/package-extension.sh`). Reads the version from `manifest.json`, copies `manifest.json` + `icons/` + `src/` + `_locales/` into a ZIP at `dist/youtube-check-v{version}.zip`. `dist/` is gitignored.

Verify changes by driving the real extension on youtube.com (badges, counter, watch indicator) — not by unit tests, which don't exist. The browser console + `chrome://extensions` service-worker inspector are the debugging surface.

## Architecture

### Module system: globals via injection order (no imports)

Every file is an IIFE that assigns one global. There are no ES imports — files depend on each other purely through **load order**, defined in `manifest.json` `content_scripts[].js`:

```
messages.js → i18n.js → storage.js → youtube-parser.js → dom-observer.js → content.js
```

Each earlier file must define its global before a later one uses it: `YTCheckMessages`, `YTCheckI18n`, `YTCheckStorage`, `YTParser`, `YTDomObserver`, then `content.js` orchestrates. `popup.html` and `options.html` re-include the same files via their own `<script>` tags. **If you add a new module, wire it into the manifest's content_scripts list (and any HTML page that needs it) in the right position.**

### Data model — single source of truth is `storage.js`

All persistence goes through `YTCheckStorage` (`src/storage/storage.js`), which wraps two Chrome storage areas:

- **`chrome.storage.local` → `videos`**: a `{ videoId: record }` map. A record has `{ liked, disliked, watchedByProgress, title, channel, thumbnail, url, updatedAt, viewed }`. **`viewed` is always derived**: `liked || disliked || watchedByProgress`. `saveVideo` recomputes it on every write — never set `viewed` directly.
- **`chrome.storage.sync` → `settings`**: user preferences, merged over `DEFAULT_SETTINGS` and repaired by `normalizeSettings` on read (locale-aware badge text, clamped `watchProgressThreshold`).

Every storage op is wrapped in `safeStorage`, which no-ops with a fallback when the extension context is invalidated (reload during an async call). The same `isContextAlive()` guard pattern recurs in `content.js`.

### `content.js` — three detection surfaces

`content.js` is the orchestrator and handles three distinct YouTube contexts, dispatched from `_executePageChange`:

1. **Listing pages** (Home, Search, sidebar, etc.): `YTDomObserver.start` runs a debounced `MutationObserver` matching `YTParser.VIDEO_ELEMENTS_SELECTOR`; matched cards get a badge if their `videoId` is in the viewed set. A floating, draggable **page counter** tallies viewed/total.
2. **Watch page** (`/watch`): reads the like/dislike button state (retry loop + attribute observer) and persists it; optional **watch-progress tracking** listens to the `<video>` `timeupdate` and marks viewed past a threshold (opt-in, `settings.trackWatchProgress`). Injects the "you already rated this" indicator pill.
3. **Shorts player** (`/shorts/ID`): its own monitoring stack — URL polling, click capture, per-reel attribute observers, and a bootstrap retry loop for hard reloads. The whole scroll session counts as one "page" for the counter.

SPA navigation is caught by `YTDomObserver.watchNavigation`, which patches `history.pushState`/`replaceState` and listens for `yt-navigate-finish` (YouTube fires no standard navigation event).

### Adding support for a new YouTube surface (common task)

YouTube A/B-tests its DOM and migrates components (e.g. the watch-page sidebar moved from `ytd-compact-video-renderer` to the newer `yt-lockup-view-model`). To make badges appear on a card type that currently has none:

1. Add its element tag to `VIDEO_ELEMENT_TAGS` in `youtube-parser.js`.
2. Confirm `extractFromElement` resolves a `videoId` from it (anchor href), and that `getThumbnailContainer` returns the correct positioning parent for the badge.
3. Extend the hover / viewed-tint selectors in `content/content.css` if the thumbnail container tag is new.

Validate the exact live selectors before coding — YouTube's real DOM is the authority, not assumptions. `youtube-parser.js` selectors are deliberately **layered with fallbacks** (modern `*-view-model` components → legacy `ytd-*-renderer` → `aria-label` keyword matching in **both English and Portuguese**); follow that defensive style.

### Two independent i18n systems — don't conflate them

- **Runtime UI/badge text**: the custom `YTCheckI18n` + `YTCheckMessages` (`src/i18n/`), supporting `en` / `pt-BR` with locale `auto | en | pt-BR`. This drives everything the user sees.
- **`_locales/`**: Chrome's native i18n, used **only** to localize the manifest's `extName` (`__MSG_extName__`). It is not the runtime catalog.

### Background service worker

`src/background/service-worker.js`: on install, opens `src/onboarding/welcome.html` and arms a daily `chrome.alarms` job that prunes videos older than `settings.historyRetentionDays` (0 = keep forever). Also routes `refreshAllTabs` / `exportData` messages. Popup/options talk to content scripts either directly or via this router.

## Release flow

Whenever you cut a new version / produce a build, **all of the following must be updated in the same change** so nothing drifts:

1. Bump `version` in **both** `manifest.json` and `package.json` (keep them identical).
2. Add a dated entry to `CHANGELOG.md` (`## [x.y.z] - YYYY-MM-DD`, Keep a Changelog format).
3. Update the ready-to-paste store listings — bump the version marker and add/replace the "What's new" note in **all three**, keeping PT-BR and English in step:
   - `docs/store-description.en.md` — canonical English listing (name, short + detailed description, per-version "What's new").
   - `docs/store-description.pt-BR.md` — canonical Portuguese (Brasil) listing, mirror of the English one.
   - `docs/chrome-web-store.md` — the full publishing guide; its embedded description/“What's new” blocks must match the two files above.
4. `npm run package`, then upload the ZIP in the Chrome Web Store dashboard.

The two `docs/store-description.*` files exist specifically so publishing is copy-paste: grab the whole listing from the file for the matching dashboard language. They are the source of truth for listing copy — edit them first, then reconcile `docs/chrome-web-store.md`.

The privacy policy is served from `store/privacy-policy.html`.

**Also keep this CLAUDE.md current**: when a change alters the build/release steps, the module load order, the storage schema, or the set of docs that must be updated, reflect it here in the same commit.
