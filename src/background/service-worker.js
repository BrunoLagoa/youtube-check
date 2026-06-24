/**
 * YouTube Check — Background Service Worker (Manifest V3)
 * Handles lifecycle events and cross-context messaging.
 */

// ─── INSTALLATION / UPGRADE ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('[YouTube Check] Extension installed.');
    // Open options page on first install to let user configure
    // chrome.runtime.openOptionsPage();
  }

  if (reason === 'update') {
    console.log('[YouTube Check] Extension updated.');
  }
});

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
