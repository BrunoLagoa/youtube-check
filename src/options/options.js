/**
 * YouTube Check — Options Page Script
 * Loads and persists extension settings via chrome.storage.sync.
 */

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  enabled: true,
  badgeColor: '#00b894',
  badgeText: '✓ Visualizado',
  displayMode: 'badge',
  hideViewed: false,
  highlightUnviewed: false,
  showPageCounter: true,
};

// ─── ELEMENTS ─────────────────────────────────────────────────────────────────

const els = {
  enabled:        document.getElementById('toggle-enabled'),
  hideViewed:     document.getElementById('toggle-hide'),
  highlightUnviewed: document.getElementById('toggle-highlight'),
  showPageCounter: document.getElementById('toggle-counter'),
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
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = 'default') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type} visible`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2800);
}

// ─── LOAD SETTINGS ────────────────────────────────────────────────────────────

function applySettingsToUI(settings) {
  els.enabled.checked          = settings.enabled;
  els.hideViewed.checked       = settings.hideViewed;
  els.highlightUnviewed.checked = settings.highlightUnviewed;
  els.showPageCounter.checked  = settings.showPageCounter !== false; // Default to true
  els.badgeText.value          = settings.badgeText;
  els.badgeColor.value         = settings.badgeColor;
  els.colorHex.textContent     = settings.badgeColor;

  if (settings.displayMode === 'overlay') {
    els.modeOverlay.checked = true;
  } else {
    els.modeBadge.checked = true;
  }

  updatePreview(settings);
}

async function loadSettings() {
  chrome.storage.sync.get(['settings'], (result) => {
    const settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    applySettingsToUI(settings);
  });
}

// ─── COLLECT SETTINGS FROM UI ─────────────────────────────────────────────────

function collectSettings() {
  return {
    enabled:           els.enabled.checked,
    hideViewed:        els.hideViewed.checked,
    highlightUnviewed: els.highlightUnviewed.checked,
    showPageCounter:   els.showPageCounter.checked,
    badgeText:         els.badgeText.value.trim() || DEFAULT_SETTINGS.badgeText,
    badgeColor:        els.badgeColor.value,
    displayMode:       els.modeOverlay.checked ? 'overlay' : 'badge',
  };
}

// ─── PREVIEW ─────────────────────────────────────────────────────────────────

function updatePreview(settings) {
  const color = settings?.badgeColor || els.badgeColor.value;
  const text  = settings?.badgeText  || els.badgeText.value || DEFAULT_SETTINGS.badgeText;
  const mode  = settings?.displayMode || (els.modeOverlay.checked ? 'overlay' : 'badge');

  els.previewBadge.textContent = text;
  els.previewBadge.style.setProperty('--preview-color', color);
  els.previewBadge.style.background = color;

  // Adjust preview for overlay mode
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

  return new Promise((resolve) => {
    chrome.storage.sync.set({ settings }, () => {
      resolve();
      // Notify all YouTube content scripts
      notifyContentScripts();
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

// Live preview on changes
els.badgeColor.addEventListener('input', () => {
  els.colorHex.textContent = els.badgeColor.value;
  updatePreview();
});

els.badgeText.addEventListener('input', () => updatePreview());

els.modeBadge.addEventListener('change', () => updatePreview());
els.modeOverlay.addEventListener('change', () => updatePreview());

// Save button
els.btnSave.addEventListener('click', async () => {
  els.btnSave.disabled = true;
  await saveSettings();
  els.btnSave.disabled = false;

  // Show header status
  els.saveStatus.textContent = '✓ Configurações salvas';
  els.saveStatus.classList.add('visible');
  setTimeout(() => els.saveStatus.classList.remove('visible'), 2500);

  showToast('Configurações salvas com sucesso!', 'success');
});

// Reset button
els.btnReset.addEventListener('click', () => {
  if (!confirm('Restaurar todas as configurações para os valores padrão?')) return;
  applySettingsToUI(DEFAULT_SETTINGS);
  chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
    notifyContentScripts();
    showToast('Configurações restauradas!', 'success');
  });
});

// Auto-save on toggle changes for immediate feedback
[els.enabled, els.hideViewed, els.highlightUnviewed, els.showPageCounter].forEach((toggle) => {
  toggle.addEventListener('change', () => {
    saveSettings();
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadSettings();
