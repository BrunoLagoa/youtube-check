# YouTube Check 🎬✓

> **Languages:** English | [Português (Brasil)](README.pt-BR.md)

Chrome extension that automatically marks YouTube videos you've already rated (Like or Dislike) as **Viewed**, adding visual badges to thumbnails across the platform.

## Features

- ✅ Automatically detects liked or disliked videos — and picks up Likes given on other devices from your "Liked videos" list
- ✅ Marks a video as viewed by watch time too (on by default, 75%–95% threshold), even without a rating
- ✅ Visual "✓ Viewed" badge (or overlay) on thumbnails
- ✅ Works on Home, Search, Channel, Playlists, Related, Subscriptions, Explore, Shorts, and the playlist queue beside the player
- ✅ Watch page and Shorts indicator ("You already rated this video" / "You already watched this video")
- ✅ Floating, draggable page counter (viewed/total, or playlist progress)
- ✅ MutationObserver for infinite scroll without reloading
- ✅ Popup with statistics (including today / this week / this month), recent history and actions (export/import/clear)
- ✅ Optional full video title on cards (no "…" cut-off)
- ✅ Settings page (color, text, badge/overlay mode, hide viewed, highlight unviewed, full title, history retention, language)
- ✅ English / Portuguese (Brazil) interface
- ✅ Persistence via `chrome.storage.local` and `chrome.storage.sync`
- ✅ Manifest V3 + optimized performance

## Installation

### Developer Mode

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `youtube-check/` folder
5. The extension is active — open YouTube!

## How to use

1. **Open any video** on YouTube and give it a Like or Dislike
2. The extension automatically detects the rating and saves it locally
3. When browsing YouTube (Home, Search, etc.), rated videos show the **✓ Viewed** badge
4. Click the extension icon to see statistics
5. Open **Settings** to customize the appearance

## File structure

```
youtube-check/
├── manifest.json
├── _locales/               # manifest strings only (name, store description)
│   ├── en/messages.json
│   └── pt_BR/messages.json
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── scripts/
│   └── package-extension.sh
└── src/
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
    ├── i18n/
    │   ├── messages.js     # en / pt-BR UI catalog
    │   └── i18n.js
    ├── onboarding/
    │   ├── welcome.html
    │   ├── welcome.js
    │   └── welcome.css
    ├── popup/
    │   ├── popup.html
    │   ├── popup.js
    │   └── popup.css
    ├── options/
    │   ├── options.html
    │   ├── options.js
    │   └── options.css
    ├── storage/
    │   └── storage.js
    └── utils/
        ├── youtube-parser.js
        └── dom-observer.js
```

## Technical notes

- Like/dislike detection uses the `aria-pressed` attribute and `is-toggled` class on YouTube buttons
- The video must be opened at least once for the rating to be recorded
- Data is stored in `chrome.storage.local` (per device), one key per video (`video:<id>`)
- Settings are stored in `chrome.storage.sync` (synced across devices)

## Chrome Web Store publishing

### Generate upload package

```bash
chmod +x scripts/package-extension.sh   # first time only
npm run package
# or: ./scripts/package-extension.sh
```

The ZIP will be created at `dist/youtube-check-v{version}.zip`, with the version read from `manifest.json`.

### Full documentation

See [docs/chrome-web-store.md](docs/chrome-web-store.md) for:

- Ready-to-use listing texts (description, permissions, single purpose)
- How to host the [privacy policy](store/privacy-policy.html)
- Checklist before submitting to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)

### Privacy policy

Host `store/privacy-policy.html` at a public HTTPS URL (e.g. GitHub Pages) and provide the link in the store dashboard.

**Live URL:** https://brunolagoa.github.io/youtube-check/store/privacy-policy.html
