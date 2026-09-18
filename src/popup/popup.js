/**
 * YouTube Check — Popup Script
 * Handles statistics display and user actions.
 */

// ─── ELEMENTS ─────────────────────────────────────────────────────────────────

const els = {
  total:      document.getElementById('count-total'),
  viewed:     document.getElementById('count-viewed'),
  liked:      document.getElementById('count-liked'),
  disliked:   document.getElementById('count-disliked'),
  periodDay:   document.getElementById('count-period-day'),
  periodWeek:  document.getElementById('count-period-week'),
  periodMonth: document.getElementById('count-period-month'),
  progressBar: document.getElementById('progress-bar'),
  progressPct: document.getElementById('progress-pct'),
  historyList:  document.getElementById('history-list'),
  historyEmpty: document.getElementById('history-empty'),
  historyCount: document.getElementById('history-count'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnExport:  document.getElementById('btn-export'),
  btnImport:  document.getElementById('btn-import'),
  btnClear:   document.getElementById('btn-clear'),
  btnSettings: document.getElementById('btn-settings'),
  btnOpenYoutube: document.getElementById('btn-open-youtube'),
  importFile: document.getElementById('import-file'),
  toast:      document.getElementById('toast'),
  footerVersion: document.getElementById('footer-version'),
};

// ─── TOAST ────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(message, type = 'default') {
  els.toast.textContent = message;
  els.toast.className = `toast ${type} visible`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('visible');
  }, 2800);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function animateNumber(el, target) {
  const start = parseInt(el.textContent) || 0;
  const duration = 500;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

async function refreshStats() {
  // One read of the history feeds both the numbers and the list below.
  const videos = await YTCheckStorage.getAllVideos();
  const stats = await YTCheckStorage.getStats(videos);

  animateNumber(els.total,    stats.total);
  animateNumber(els.viewed,   stats.viewed);
  animateNumber(els.liked,    stats.liked);
  animateNumber(els.disliked, stats.disliked);

  animateNumber(els.periodDay,   stats.viewedToday);
  animateNumber(els.periodWeek,  stats.viewedThisWeek);
  animateNumber(els.periodMonth, stats.viewedThisMonth);

  const pct = stats.total > 0 ? Math.round((stats.viewed / stats.total) * 100) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressPct.textContent = `${pct}%`;
  document.querySelector('.progress-bar-track').setAttribute('aria-valuenow', pct);

  renderHistory(videos);
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────

/**
 * Records are page text (titles, channel names) or come from an imported
 * file, so everything interpolated into the list's HTML goes through here.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/**
 * `url` if it is an https URL on one of the allowed hosts, else null — an
 * imported record's `javascript:` link must never become clickable.
 * @param {string} url
 * @param {RegExp} hostPattern
 * @returns {string|null}
 */
function safeUrl(url, hostPattern) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && hostPattern.test(parsed.hostname) ? parsed.href : null;
  } catch {
    return null;
  }
}

const YOUTUBE_HOST = /^(www\.)?youtube\.com$/;
const THUMBNAIL_HOST = /^i\d*\.ytimg\.com$/;

/**
 * Render the ten most recently viewed videos — ordered and dated by when each
 * became viewed, the same clock the period counters above use.
 * @param {object} videos map of videoId -> record
 */
function renderHistory(videos) {
  const all = Object.values(videos);
  const viewed = all
    .filter((v) => v.viewed)
    .sort((a, b) => YTCheckStorage.getViewedAt(b) - YTCheckStorage.getViewedAt(a))
    .slice(0, 10);

  const viewedCount = all.filter((v) => v.viewed).length;
  els.historyCount.textContent = viewedCount > 0
    ? YTCheckI18n.t('videosCount', viewedCount)
    : '';

  if (viewed.length === 0) {
    els.historyEmpty.style.display = 'flex';
    els.historyList.style.display  = 'none';
    return;
  }

  els.historyEmpty.style.display = 'none';
  els.historyList.style.display  = 'block';
  els.historyList.innerHTML = '';

  for (const video of viewed) {
    const li = document.createElement('li');
    const videoId = encodeURIComponent(video.videoId || '');
    const href = safeUrl(video.url, YOUTUBE_HOST) || `https://www.youtube.com/watch?v=${videoId}`;
    const thumbSrc = safeUrl(video.thumbnail, THUMBNAIL_HOST) || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    const title = escapeHtml(video.title || video.videoId);

    // A video can also be viewed purely by watch time — without that third
    // case it would be mislabelled as disliked.
    let statusBadge;
    if (video.liked) {
      statusBadge = `<span class="history-badge history-badge--liked">👍 ${YTCheckI18n.t('liked')}</span>`;
    } else if (video.disliked) {
      statusBadge = `<span class="history-badge history-badge--disliked">👎 ${YTCheckI18n.t('disliked')}</span>`;
    } else {
      statusBadge = `<span class="history-badge history-badge--watched">▶ ${YTCheckI18n.t('watchedByTime')}</span>`;
    }

    li.innerHTML = `
      <a class="history-item" href="${escapeHtml(href)}" target="_blank" title="${title}">
        <div class="history-thumb">
          <img src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" />
          <div class="history-thumb-badge">✓</div>
        </div>
        <div class="history-info">
          <span class="history-video-title">${title}</span>
          <div class="history-meta">
            ${video.channel ? `<span class="history-channel">${escapeHtml(video.channel)}</span>` : ''}
            ${statusBadge}
            <span class="history-date">${YTCheckI18n.formatDate(YTCheckStorage.getViewedAt(video))}</span>
          </div>
        </div>
        <button type="button" class="history-delete" data-video-id="${escapeHtml(video.videoId)}" title="${YTCheckI18n.t('removeFromHistory')}" aria-label="${YTCheckI18n.t('removeFromHistory')}">×</button>
      </a>
    `;

    // Extension pages run under a CSP that blocks inline handlers, so an
    // `onerror="…"` attribute here would never fire — wire it up in script.
    const img = li.querySelector('img');
    img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });

    els.historyList.appendChild(li);
  }
}

// ─── HISTORY ITEM REMOVAL ──────────────────────────────────────────────────────

els.historyList.addEventListener('click', async (event) => {
  const delBtn = event.target.closest('.history-delete');
  if (!delBtn) return;

  // Stop the click from following the wrapping <a> to the video page
  event.preventDefault();
  event.stopPropagation();

  const videoId = delBtn.dataset.videoId;
  if (!videoId) return;

  await YTCheckStorage.deleteVideo(videoId);
  await refreshStats();
  showToast(YTCheckI18n.t('videoRemoved'), 'success');
});

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

async function sendToYouTube(action) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) { resolve(null); return; }

      const isYouTube = tab.url && (
        tab.url.startsWith('https://www.youtube.com') ||
        tab.url.startsWith('https://youtube.com')
      );

      if (!isYouTube) { resolve(null); return; }

      chrome.tabs.sendMessage(tab.id, { action }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  });
}

els.btnRefresh.addEventListener('click', async () => {
  els.btnRefresh.classList.add('loading');

  const res = await sendToYouTube('refresh');
  await refreshStats();

  els.btnRefresh.classList.remove('loading');
  showToast(
    res ? YTCheckI18n.t('badgesUpdated') : YTCheckI18n.t('statsUpdated'),
    'success'
  );
});

els.btnExport.addEventListener('click', async () => {
  const json = await YTCheckStorage.exportVideos();

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `youtube-check-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(YTCheckI18n.t('exportSuccess'), 'success');
});

els.btnImport.addEventListener('click', () => {
  els.importFile.click();
});

els.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    // Delegated to the storage layer so `viewed` is derived exactly like
    // everywhere else — a local copy of this merge used to drop
    // watchedByProgress, un-marking videos tracked by watch time.
    const { imported, reason } = await YTCheckStorage.importVideos(event.target.result);

    if (imported > 0) {
      await refreshStats();
      showToast(YTCheckI18n.t('videosImported', imported), 'success');
    } else {
      showToast(
        YTCheckI18n.t(reason === 'parse' ? 'jsonError' : 'invalidFile'),
        'error'
      );
    }

    els.importFile.value = '';
  };
  reader.readAsText(file);
});

els.btnClear.addEventListener('click', async () => {
  if (!confirm(YTCheckI18n.t('confirmClear'))) return;

  await YTCheckStorage.clearVideos();
  await refreshStats();
  sendToYouTube('clearHistory');
  showToast(YTCheckI18n.t('historyCleared'), 'success');
});

els.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

els.btnOpenYoutube.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.youtube.com' });
  window.close();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

(async function init() {
  const settings = await YTCheckStorage.getSettings();
  YTCheckI18n.init(settings);
  document.title = YTCheckI18n.t('extName');
  els.footerVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  refreshStats();
})();
