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
  importFile: document.getElementById('import-file'),
  toast:      document.getElementById('toast'),
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

async function loadStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['videos'], (result) => {
      const videos = Object.values(result.videos || {});
      resolve({
        total:    videos.length,
        liked:    videos.filter((v) => v.liked).length,
        disliked: videos.filter((v) => v.disliked).length,
        viewed:   videos.filter((v) => v.viewed).length,
      });
    });
  });
}

function animateNumber(el, target) {
  const start = parseInt(el.textContent) || 0;
  const duration = 500;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

async function refreshStats() {
  const stats = await loadStats();

  animateNumber(els.total,    stats.total);
  animateNumber(els.viewed,   stats.viewed);
  animateNumber(els.liked,    stats.liked);
  animateNumber(els.disliked, stats.disliked);

  const pct = stats.total > 0 ? Math.round((stats.viewed / stats.total) * 100) : 0;
  els.progressBar.style.width = `${pct}%`;
  els.progressPct.textContent = `${pct}%`;
  document.querySelector('.progress-bar-track').setAttribute('aria-valuenow', pct);

  await renderHistory();
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────

/**
 * Format a timestamp as a relative or absolute date string.
 * @param {number} ts - Unix timestamp in milliseconds
 */
function formatDate(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);

  if (min < 1)  return 'agora';
  if (min < 60) return `${min}min`;
  if (hr  < 24) return `${hr}h`;
  if (day < 7)  return `${day}d`;
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Render the recent video history list.
 * Shows the 10 most recently updated viewed videos, sorted by updatedAt desc.
 */
async function renderHistory() {
  const data = await new Promise((resolve) => {
    chrome.storage.local.get(['videos'], (r) => resolve(r.videos || {}));
  });

  const all = Object.values(data);
  const viewed = all
    .filter((v) => v.viewed)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 10);

  // Update count badge
  els.historyCount.textContent = all.filter((v) => v.viewed).length > 0
    ? `${all.filter((v) => v.viewed).length} vídeos`
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
    const thumbSrc = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;

    const statusBadge = video.liked
      ? `<span class="history-badge history-badge--liked">👍 Curtido</span>`
      : `<span class="history-badge history-badge--disliked">👎 Não curtido</span>`;

    li.innerHTML = `
      <a class="history-item" href="${video.url || `https://youtube.com/watch?v=${video.videoId}`}" target="_blank" title="${video.title || video.videoId}">
        <div class="history-thumb">
          <img src="${thumbSrc}" alt="" loading="lazy" onerror="this.style.display='none'" />
          <div class="history-thumb-badge">✓</div>
        </div>
        <div class="history-info">
          <span class="history-video-title">${video.title || video.videoId}</span>
          <div class="history-meta">
            ${video.channel ? `<span class="history-channel">${video.channel}</span>` : ''}
            ${statusBadge}
            <span class="history-date">${formatDate(video.updatedAt)}</span>
          </div>
        </div>
      </a>
    `;
    els.historyList.appendChild(li);
  }
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

/** Send a message to the active YouTube tab */
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

// Refresh
els.btnRefresh.addEventListener('click', async () => {
  els.btnRefresh.classList.add('loading');

  const res = await sendToYouTube('refresh');
  await refreshStats();

  els.btnRefresh.classList.remove('loading');
  showToast(res ? 'Badges atualizados!' : 'Estatísticas atualizadas!', 'success');
});

// Export JSON
els.btnExport.addEventListener('click', async () => {
  chrome.storage.local.get(['videos'], (result) => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      videos: result.videos || {},
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `youtube-check-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('Exportado com sucesso!', 'success');
  });
});

// Import JSON
els.btnImport.addEventListener('click', () => {
  els.importFile.click();
});

els.importFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const text = event.target.result;
      const parsed = JSON.parse(text);
      const incoming = parsed.videos || parsed;

      if (typeof incoming !== 'object' || Array.isArray(incoming)) {
        showToast('Formato de arquivo inválido.', 'error');
        return;
      }

      chrome.storage.local.get(['videos'], (result) => {
        const videos = { ...(result.videos || {}), ...incoming };
        // Recalculate viewed for all
        for (const id of Object.keys(videos)) {
          videos[id].viewed = !!(videos[id].liked || videos[id].disliked);
        }
        chrome.storage.local.set({ videos }, async () => {
          await refreshStats();
          showToast(`${Object.keys(incoming).length} vídeos importados!`, 'success');
        });
      });
    } catch {
      showToast('Erro ao ler o arquivo JSON.', 'error');
    }
    // Reset file input
    els.importFile.value = '';
  };
  reader.readAsText(file);
});

// Clear
els.btnClear.addEventListener('click', () => {
  if (!confirm('Tem certeza que deseja limpar todo o histórico de vídeos?')) return;

  chrome.storage.local.set({ videos: {} }, async () => {
    await refreshStats();
    // Notify content script if on YouTube
    sendToYouTube('clearHistory');
    showToast('Histórico limpo!', 'success');
  });
});

// Settings
els.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

refreshStats();
