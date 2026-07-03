/**
 * YouTube Check — Options Page Script
 * Loads and persists extension settings via chrome.storage.sync.
 */

const DEFAULT_SETTINGS = YTCheckStorage.DEFAULT_SETTINGS;

// ─── ELEMENTS ─────────────────────────────────────────────────────────────────

const els = {
  locale:         document.getElementById('select-locale'),
  enabled:        document.getElementById('toggle-enabled'),
  hideViewed:     document.getElementById('toggle-hide'),
  highlightUnviewed: document.getElementById('toggle-highlight'),
  showPageCounter: document.getElementById('toggle-counter'),
  retention:      document.getElementById('select-retention'),
  badgeText:      document.getElementById('input-badge-text'),
  badgeColor:     document.getElementById('input-badge-color'),
  colorHex:       document.getElementById('color-hex'),
  modeBadge:      document.getElementById('mode-badge'),
  modeOverlay:    document.getElementById('mode-overlay'),
  previewBadge:   document.getElementById('preview-badge'),
  btnSave:        document.getElementById('btn-save'),
  btnReset:       document.getElementById('btn-reset'),
  toast:          document.getElementById('toast'),
  saveStatus:     document.getElementById('save-status'),
  footerVersion:  document.getElementById('footer-version'),
};

let previousLocale = 'auto';

// Baseline for fields the Options UI doesn't expose (e.g. the drag-to-reposition
// counter coordinates, set only from the YouTube page) so saving here never wipes them.
let _loadedSettings = DEFAULT_SETTINGS;

// ─── TOAST ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = 'default') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type} visible`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2800);
}

// ─── I18N UI ──────────────────────────────────────────────────────────────────

function applyI18n(settings) {
  YTCheckI18n.init(settings);
  document.title = YTCheckI18n.t('optionsPageTitle');

  // Re-translate <option> labels (not covered by data-i18n on parent)
  els.locale.querySelectorAll('option[data-i18n]').forEach((opt) => {
    opt.textContent = YTCheckI18n.t(opt.dataset.i18n);
  });
  els.locale.setAttribute('aria-label', YTCheckI18n.t('localeLabel'));

  els.retention.querySelectorAll('option').forEach((opt) => {
    opt.textContent = opt.value === '0'
      ? YTCheckI18n.t('retentionForever')
      : YTCheckI18n.t('retentionDays', opt.value);
  });
  els.retention.setAttribute('aria-label', YTCheckI18n.t('retentionLabel'));
}

// ─── LOAD SETTINGS ────────────────────────────────────────────────────────────

function applySettingsToUI(settings) {
  els.locale.value = settings.locale || 'auto';
  previousLocale = settings.locale || 'auto';

  els.enabled.checked = settings.enabled;
  els.hideViewed.checked = settings.hideViewed;
  els.highlightUnviewed.checked = settings.highlightUnviewed;
  els.showPageCounter.checked = settings.showPageCounter !== false;
  els.retention.value = String(settings.historyRetentionDays || 0);
  els.badgeText.value = settings.badgeText;
  els.badgeColor.value = settings.badgeColor;
  els.colorHex.textContent = settings.badgeColor;

  if (settings.displayMode === 'overlay') {
    els.modeOverlay.checked = true;
  } else {
    els.modeBadge.checked = true;
  }

  updatePreview(settings);
}

async function loadSettings() {
  const settings = await YTCheckStorage.getSettings();
  _loadedSettings = settings;
  applyI18n(settings);
  applySettingsToUI(settings);
}

// ─── COLLECT SETTINGS FROM UI ─────────────────────────────────────────────────

function collectSettings() {
  const locale = els.locale.value || 'auto';
  const resolvedLocale = YTCheckI18n.resolveLocale(locale);
  const defaultBadge = YTCheckI18n.getDefaultBadgeText(resolvedLocale);
  const badgeTextInput = els.badgeText.value.trim();

  let badgeText = badgeTextInput || defaultBadge;

  // Update default badge text when locale changes and user kept the default
  if (locale !== previousLocale && YTCheckI18n.isDefaultBadgeText(badgeTextInput)) {
    badgeText = defaultBadge;
    els.badgeText.value = badgeText;
  }

  return {
    ..._loadedSettings, // preserves fields not exposed in this UI (e.g. counterPositionX/Y)
    locale,
    enabled: els.enabled.checked,
    hideViewed: els.hideViewed.checked,
    highlightUnviewed: els.highlightUnviewed.checked,
    showPageCounter: els.showPageCounter.checked,
    historyRetentionDays: parseInt(els.retention.value, 10) || 0,
    badgeText,
    badgeColor: els.badgeColor.value,
    displayMode: els.modeOverlay.checked ? 'overlay' : 'badge',
  };
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────

function updatePreview(settings) {
  const color = settings?.badgeColor || els.badgeColor.value;
  const text = settings?.badgeText || els.badgeText.value || YTCheckI18n.getDefaultBadgeText();
  const mode = settings?.displayMode || (els.modeOverlay.checked ? 'overlay' : 'badge');

  els.previewBadge.textContent = text;
  els.previewBadge.style.setProperty('--preview-color', color);
  els.previewBadge.style.background = color;

  const thumb = els.previewBadge.closest('.preview-thumbnail');
  if (mode === 'overlay') {
    els.previewBadge.style.top = '50%';
    els.previewBadge.style.right = '50%';
    els.previewBadge.style.transform = 'translate(50%, -50%)';
    els.previewBadge.style.fontSize = '13px';
    els.previewBadge.style.padding = '6px 14px';
    if (thumb) thumb.style.background = 'rgba(0,0,0,0.4)';
  } else {
    els.previewBadge.style.top = '8px';
    els.previewBadge.style.right = '8px';
    els.previewBadge.style.transform = '';
    els.previewBadge.style.fontSize = '11px';
    els.previewBadge.style.padding = '3px 9px';
    if (thumb) thumb.style.background = '';
  }
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

async function saveSettings() {
  const settings = collectSettings();
  previousLocale = settings.locale;
  _loadedSettings = settings;

  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      applyI18n(settings);
      notifyContentScripts();
      resolve();
    });
  });
}

function notifyContentScripts() {
  chrome.tabs.query({ url: ['https://www.youtube.com/*', 'https://youtube.com/*'] }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsChanged' }).catch(() => {});
    }
  });
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

els.badgeColor.addEventListener('input', () => {
  els.colorHex.textContent = els.badgeColor.value;
  updatePreview();
});

els.badgeText.addEventListener('input', () => updatePreview());

els.modeBadge.addEventListener('change', () => updatePreview());
els.modeOverlay.addEventListener('change', () => updatePreview());

els.locale.addEventListener('change', async () => {
  const settings = collectSettings();
  applyI18n(settings);

  if (YTCheckI18n.isDefaultBadgeText(els.badgeText.value.trim())) {
    els.badgeText.value = YTCheckI18n.getDefaultBadgeText();
    els.badgeText.placeholder = YTCheckI18n.t('badgeTextPlaceholder');
    updatePreview();
  }

  await saveSettings();
});

els.btnSave.addEventListener('click', async () => {
  els.btnSave.disabled = true;
  await saveSettings();
  els.btnSave.disabled = false;

  els.saveStatus.textContent = YTCheckI18n.t('settingsSaved');
  els.saveStatus.classList.add('visible');
  setTimeout(() => els.saveStatus.classList.remove('visible'), 2500);

  showToast(YTCheckI18n.t('settingsSavedSuccess'), 'success');
});

els.btnReset.addEventListener('click', async () => {
  if (!confirm(YTCheckI18n.t('confirmReset'))) return;

  const locale = els.locale.value || 'auto';
  const resolvedLocale = YTCheckI18n.resolveLocale(locale);
  const reset = {
    ...DEFAULT_SETTINGS,
    locale,
    badgeText: YTCheckI18n.getDefaultBadgeText(resolvedLocale),
  };

  applySettingsToUI(reset);
  applyI18n(reset);
  _loadedSettings = reset;

  chrome.storage.sync.set({ settings: reset }, () => {
    previousLocale = locale;
    notifyContentScripts();
    showToast(YTCheckI18n.t('settingsRestored'), 'success');
  });
});

[els.enabled, els.hideViewed, els.highlightUnviewed, els.showPageCounter, els.retention].forEach((toggle) => {
  toggle.addEventListener('change', () => {
    saveSettings();
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
els.footerVersion.textContent = `v${chrome.runtime.getManifest().version}`;
loadSettings();
