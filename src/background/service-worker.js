/**
 * YouTube Check — Background Service Worker (Manifest V3)
 * Handles lifecycle events: onboarding, first-run injection, storage
 * migration and history retention.
 */

// Same storage layer (and the i18n it normalizes settings with) as every other
// context, so the worker can never drift from the record format. Classic
// worker on purpose: these files are plain scripts that declare globals, which
// an ES-module worker could not share.
importScripts('../i18n/messages.js', '../i18n/i18n.js', '../storage/storage.js');

const PRUNE_ALARM = 'ytcheck-prune-old-videos';

// ─── INSTALLATION / UPGRADE ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/welcome.html') });

    // Chrome only injects declared content scripts on a page's *next* load, so
    // every YouTube tab already open at install time stays dead until the user
    // reloads it by hand — which reads as "the extension doesn't work".
    // Install only: after an update the previous content script's isolated
    // world survives in those tabs with all the module globals still declared,
    // so re-running the files there would only throw redeclaration errors.
    injectIntoOpenYouTubeTabs();
  }

  // Updating from before 1.9.0: move the single `videos` map into per-video
  // keys now, rather than waiting for the first page that touches the history.
  YTCheckStorage.migrateLegacyVideos();

  chrome.alarms.create(PRUNE_ALARM, { periodInMinutes: 1440 });
});

/**
 * Run the declared content scripts in YouTube tabs that are already open.
 * Files and order come from the manifest itself, so this can't drift from the
 * `content_scripts` load order the modules depend on.
 */
async function injectIntoOpenYouTubeTabs() {
  const [contentScript] = chrome.runtime.getManifest().content_scripts;
  if (!contentScript) return;

  const tabs = await chrome.tabs.query({
    url: ['https://www.youtube.com/*', 'https://youtube.com/*'],
  });

  for (const tab of tabs) {
    // A live content script answers 'ping' — injecting over it would run every
    // module twice in the same page.
    const alive = await chrome.tabs
      .sendMessage(tab.id, { action: 'ping' })
      .then(() => true)
      .catch(() => false);
    if (alive) continue;

    try {
      if (contentScript.css?.length) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: contentScript.css });
      }
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: contentScript.js });
    } catch {
      // Tab may be discarded, mid-navigation, or otherwise not injectable
    }
  }
}

// Defensive re-arm on browser startup, in case onInstalled was missed — and a
// second chance for a migration the browser closed in the middle of.
chrome.runtime.onStartup.addListener(() => {
  YTCheckStorage.migrateLegacyVideos();
  chrome.alarms.create(PRUNE_ALARM, { periodInMinutes: 1440 });
});

// ─── HISTORY RETENTION (AUTO-CLEANUP) ─────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== PRUNE_ALARM) return;
  // No-op when historyRetentionDays is 0 (default — keep forever).
  const { historyRetentionDays } = await YTCheckStorage.getSettings();
  await YTCheckStorage.pruneOldVideos(historyRetentionDays);
});
