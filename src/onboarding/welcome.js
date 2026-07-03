/**
 * YouTube Check — Welcome / Onboarding Page Script
 * Shown once, in a new tab, right after install.
 */

document.getElementById('footer-version').textContent = `v${chrome.runtime.getManifest().version}`;

document.getElementById('btn-open-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

(async function init() {
  const settings = await YTCheckStorage.getSettings();
  YTCheckI18n.init(settings);
})();
