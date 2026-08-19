# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**YouTube Check** — a Manifest V3 Chrome extension (vanilla JS, no framework, no bundler) that marks YouTube videos you've rated (Like/Dislike) or watched-to-completion with a "✓ Viewed" badge on thumbnails across the platform.

## Commands

There is **no build step and no test suite**. `src/` is loaded directly as the extension — `manifest.json` references `src/...` paths as-is.

- **Load / develop:** `chrome://extensions` → enable Developer mode → **Load unpacked** → select the repo root. After editing any file, click the reload icon on the extension card, then **F5** the YouTube tab.
- **Package for the store:** `npm run package` (or `./scripts/package-extension.sh`). Reads the version from `manifest.json`, copies `manifest.json` + `icons/` + `src/` + `_locales/` into a ZIP at `dist/youtube-check-v{version}.zip`. `dist/` is gitignored.

Verify changes by driving the real extension on youtube.com (badges, counter, watch indicator) — not by unit tests, which don't exist. The browser console + `chrome://extensions` service-worker inspector are the debugging surface.

### Browser automation (Claude in Chrome)

More than one Chrome instance is usually connected to this account, and **only one of them has the unpacked extension loaded**. The right one is the browser named **`Bruno`** (macOS, local) — always work there.

At the start of any browser session:

1. `list_connected_browsers` → find the entry whose `name` is `Bruno`.
2. `select_browser` with that `deviceId`. Device IDs are not stable across reinstalls/reconnects, so resolve by name, never by a hardcoded ID.
3. If no `Bruno` entry shows up, fall back to `switch_browser` — it prompts every connected Chrome and the user clicks **Connect** in the right one.
4. Then `tabs_context_mcp` (with `createIfEmpty: true`) and work in a **new** tab; don't hijack tabs the user already has open.

## Architecture

### Module system: globals via injection order (no imports)

Every file is an IIFE that assigns one global. There are no ES imports — files depend on each other purely through **load order**, defined in `manifest.json` `content_scripts[].js`:

```
messages.js → i18n.js → storage.js → youtube-parser.js → dom-observer.js → content.js
```

Each earlier file must define its global before a later one uses it: `YTCheckMessages`, `YTCheckI18n`, `YTCheckStorage`, `YTParser`, `YTDomObserver`, then `content.js` orchestrates. `popup.html` and `options.html` re-include the same files via their own `<script>` tags. **If you add a new module, wire it into the manifest's content_scripts list (and any HTML page that needs it) in the right position.**

### Data model — single source of truth is `storage.js`

All persistence goes through `YTCheckStorage` (`src/storage/storage.js`), which wraps two Chrome storage areas:

- **`chrome.storage.local` → `videos`**: a `{ videoId: record }` map. A record has `{ liked, disliked, watchedByProgress, title, channel, thumbnail, url, updatedAt, viewedAt, viewed }`. **`viewed` is always derived**: `liked || disliked || watchedByProgress`. `saveVideo` recomputes it on every write — never set `viewed` directly. **`viewedAt` is stamped once**, when the record first becomes viewed, and deleted when it stops being viewed; `updatedAt` moves on every write, so only `viewedAt` can date the popup's today/week/month counters (`getStats`). Records written before 1.7.0 have no `viewedAt` — every reader must fall back to `updatedAt`.
- **`chrome.storage.sync` → `settings`**: user preferences, merged over `DEFAULT_SETTINGS` and repaired by `normalizeSettings` on read (locale-aware badge text, clamped `watchProgressThreshold`).

Every storage op is wrapped in `safeStorage`, which no-ops with a fallback when the extension context is invalidated (reload during an async call). The same `isContextAlive()` guard pattern recurs in `content.js`.

### `content.js` — three detection surfaces

`content.js` is the orchestrator and handles three distinct YouTube contexts, dispatched from `_executePageChange`:

1. **Listing pages** (Home, Search, sidebar, etc.): `YTDomObserver.start` runs a debounced `MutationObserver` matching `YTParser.VIDEO_ELEMENTS_SELECTOR`; matched cards get a badge if their `videoId` is in the viewed set. A floating, draggable **page counter** tallies viewed/total. When the page carries a playlist queue (`YTParser.PLAYLIST_PANEL_SELECTOR` matches — `/watch?list=…`, autoplay queue, Mix), the counter scopes itself to those items only and switches its label to `viewedInPlaylist`, so it reads as playlist progress instead of lumping the queue in with the recommendations beside it.
2. **Watch page** (`/watch`): reads the like/dislike button state (retry loop + attribute observer) and persists it; **watch-progress tracking** listens to the `<video>` `timeupdate` and marks viewed past a threshold (on by default, `settings.trackWatchProgress`). Injects the "you already rated this" indicator pill.
3. **Shorts player** (`/shorts/ID`): its own monitoring stack — URL polling, click capture, per-reel attribute observers, and a bootstrap retry loop for hard reloads. The whole scroll session counts as one "page" for the counter.

SPA navigation is caught by `YTDomObserver.watchNavigation`, which patches `history.pushState`/`replaceState` and listens for `yt-navigate-finish` (YouTube fires no standard navigation event).

**Never resolve a rating element with a bare `document.querySelector`.** For a good ten seconds after an SPA navigation YouTube keeps the previous page mounted, so several zero-sized `#top-level-buttons-computed` leftovers sit *earlier* in document order than the watch page's real action bar. Anchoring the like observer to one of those made a like register only after a manual reload — the "extension doesn't work on a fresh install" bug. `YTParser.getRatingActionBar()` resolves the container *from the on-screen button* instead (`_findRatingButton` already discards zero-sized copies), and `bindRatingClickCapture()` in `content.js` backs the observer with a capture-phase click listener covering both the watch page and Shorts, so a rating is never silently dropped.

Chrome does not inject declared content scripts into pages that are already open, so `service-worker.js` runs them itself (`injectIntoOpenYouTubeTabs`, hence the `scripting` permission) on `install`. Not on `update`: the previous content script's isolated world survives there with every module global still declared, so re-running the files would only throw redeclaration errors.

**Pure-CSS features are toggled by a class on `<html>`**, not by DOM injection: `settings.fullTitle` ("show full video title") only makes `content.js` call `applyFullTitleSetting()`, which flips `html.ytcheck-full-title`; the rules live in the *full video title* block of `content.css` and target the title selectors directly. Because the CSS is scoped to that class, turning the setting off restores YouTube's own layout with no cleanup pass. Follow this pattern for other layout tweaks — and keep the title selectors layered (modern `*ViewModelTitle` → legacy `#video-title`) like `youtube-parser.js` does.

### Adding support for a new YouTube surface (common task)

YouTube A/B-tests its DOM and migrates components (e.g. the watch-page sidebar moved from `ytd-compact-video-renderer` to the newer `yt-lockup-view-model`). To make badges appear on a card type that currently has none:

1. Add its element tag to `VIDEO_ELEMENT_TAGS` in `youtube-parser.js`.
2. Confirm `extractFromElement` resolves a `videoId` from it (anchor href), and that `getThumbnailContainer` returns the correct positioning parent for the badge.
3. Extend the hover / viewed-tint selectors in `content/content.css` if the thumbnail container tag is new.

**The same video is often several matching nodes.** YouTube nests card tags — `ytd-rich-item-renderer` > `ytm-shorts-lockup-view-model-v2` > `ytm-shorts-lockup-view-model` on the Shorts tab, `ytd-rich-item-renderer` > `yt-lockup-view-model` on the home grid — and it only wraps them *sometimes*: the `ytd-reel-shelf-renderer` carousel (channel Início tab, search) ships a bare Shorts lockup, which is why the tag has to be listed even though the wrapper already was. `YTParser.getCardRoot()` collapses a nested match onto the outermost node resolving to the same video id; `content.js` runs every batch through it before badging and skips inner matches when tallying the page counter, so listing a tag that is usually wrapped costs nothing.

Validate the exact live selectors before coding — YouTube's real DOM is the authority, not assumptions. `youtube-parser.js` selectors are deliberately **layered with fallbacks** (modern `*-view-model` components → legacy `ytd-*-renderer` → `aria-label` keyword matching in **both English and Portuguese**); follow that defensive style.

### Two independent i18n systems — don't conflate them

- **Runtime UI/badge text**: the custom `YTCheckI18n` + `YTCheckMessages` (`src/i18n/`), supporting `en` / `pt-BR` with locale `auto | en | pt-BR`. This drives everything the user sees.
- **`_locales/`**: Chrome's native i18n, used **only** for the manifest's own strings — `extName` (`__MSG_extName__`) and `extDescription` (`__MSG_extDescription__`, the store listing's short description). It is not the runtime catalog. Changing the listing's short description means editing `_locales/en` **and** `_locales/pt_BR`.

### Background service worker

`src/background/service-worker.js`: on install, opens `src/onboarding/welcome.html` and arms a daily `chrome.alarms` job that prunes videos older than `settings.historyRetentionDays` (0 = keep forever). Also routes `refreshAllTabs` / `exportData` messages. Popup/options talk to content scripts either directly or via this router.

## Release flow

The steps below are packaged as the project skill `/release` (`.claude/skills/release/SKILL.md`) — invoke it to cut a version. Keep the two in sync: a change to this section must be mirrored in the skill.

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
