/**
 * YouTube Check — Background Service Worker (Manifest V3)
 * Handles lifecycle events and cross-context messaging.
 */

const PRUNE_ALARM = 'ytcheck-prune-old-videos';

// ─── INSTALLATION / UPGRADE ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    // First install — user can open options from the popup
  }

  if (reason === 'update') {
    // Extension updated
  }

  chrome.alarms.create(PRUNE_ALARM, { periodInMinutes: 1440 });
});

// Defensive re-arm on browser startup, in case onInstalled was missed.
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(PRUNE_ALARM, { periodInMinutes: 1440 });
});

// ─── HISTORY RETENTION (AUTO-CLEANUP) ─────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PRUNE_ALARM) pruneOldVideos();
});

/**
 * Remove tracked videos last updated before the user's configured retention
 * window. No-op when historyRetentionDays is 0/unset (default — keep forever).
 */
async function pruneOldVideos() {
  const { settings } = await chrome.storage.sync.get(['settings']);
  const retentionDays = settings?.historyRetentionDays || 0;
  if (retentionDays <= 0) return;

  const { videos } = await chrome.storage.local.get(['videos']);
  if (!videos) return;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const [id, data] of Object.entries(videos)) {
    if ((data.updatedAt || 0) < cutoff) {
      delete videos[id];
      removed++;
    }
  }

  if (removed > 0) {
    await chrome.storage.local.set({ videos });
  }
}

// ─── MESSAGE ROUTER ───────────────────────────────────────────────────────────

/**
 * Route messages between popup/options and content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    // Forward refresh request to all YouTube tabs
    case 'refreshAllTabs':
      refreshYouTubeTabs().then((count) => sendResponse({ ok: true, tabs: count }));
      return true;

    // Export: get all data and return it
    case 'exportData':
      chrome.storage.local.get(['videos'], (result) => {
        const data = {
          exportedAt: Date.now(),
          version: chrome.runtime.getManifest().version,
          videos: result.videos || {},
        };
        sendResponse({ ok: true, data });
      });
      return true;

    default:
      break;
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Send a 'refresh' message to all active YouTube tabs.
 * @returns {Promise<number>} Number of tabs messaged
 */
async function refreshYouTubeTabs() {
  const tabs = await chrome.tabs.query({
    url: ['https://www.youtube.com/*', 'https://youtube.com/*'],
  });

  let count = 0;
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'refresh' });
      count++;
    } catch {
      // Tab may not have the content script loaded yet
    }
  }
  return count;
}
