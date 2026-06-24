# YouTube Check 🎬✓

> **Languages:** English | [Português (Brasil)](README.pt-BR.md)

Chrome extension that automatically marks YouTube videos you've already rated (Like or Dislike) as **Viewed**, adding visual badges to thumbnails across the platform.

## Features

- ✅ Automatically detects liked or disliked videos
- ✅ Visual "✓ Viewed" badge on thumbnails
- ✅ Works on Home, Search, Channel, Playlists, Related, Subscriptions, Explore, Shorts
- ✅ MutationObserver for infinite scroll without reloading
- ✅ Popup with statistics and actions (export/import/clear)
- ✅ Settings page (color, text, badge/overlay mode, hide viewed)
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
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── src/
    ├── background/
    │   └── service-worker.js
    ├── content/
    │   ├── content.js
    │   └── content.css
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
- Data is stored in `chrome.storage.local` (per device)
- Settings are stored in `chrome.storage.sync` (synced across devices)

## Chrome Web Store publishing

### Generate upload package

```bash
chmod +x scripts/package-extension.sh   # first time only
npm run package
# or: ./scripts/package-extension.sh
```

The ZIP will be created at `dist/youtube-check-v1.1.0.zip`.

### Full documentation

See [docs/chrome-web-store.md](docs/chrome-web-store.md) for:

- Ready-to-use listing texts (description, permissions, single purpose)
- How to host the [privacy policy](store/privacy-policy.html)
- Checklist before submitting to the [Developer Dashboard](https://chrome.google.com/webstore/devconsole)

### Privacy policy

Host `store/privacy-policy.html` at a public HTTPS URL (e.g. GitHub Pages) and provide the link in the store dashboard.

**Live URL:** https://brunolagoa.github.io/youtube-check/store/privacy-policy.html
