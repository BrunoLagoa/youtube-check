/**
 * YouTube Check — Storage Layer
 * Abstraction over chrome.storage.local (videos) and chrome.storage.sync (settings)
 */

const YTCheckStorage = (() => {

  // ─── CONTEXT GUARD ────────────────────────────────────────────────────────────

  /**
   * Returns true if the extension context is still valid.
   * Accessing chrome.runtime.id throws or returns undefined when invalidated.
   */
  function isContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  /**
   * Safe wrapper: runs a chrome.storage operation only if context is valid.
   * Resolves with the fallback value if context is gone.
   * @param {function} fn - function that receives (resolve, reject)
   * @param {*} fallback - value to resolve with when context is invalid
   */
  function safeStorage(fn, fallback = undefined) {
    return new Promise((resolve) => {
      if (!isContextValid()) {
        resolve(fallback);
        return;
      }
      try {
        fn(resolve);
      } catch {
        resolve(fallback);
      }
    });
  }

  // ─── DEFAULTS ────────────────────────────────────────────────────────────────

  const DEFAULT_SETTINGS = {
    enabled: true,
    badgeColor: '#00b894',
    badgeText: '',
    displayMode: 'badge',       // 'badge' | 'overlay'
    hideViewed: false,
    highlightUnviewed: false,
    showPageCounter: true,
    locale: 'auto',             // 'auto' | 'en' | 'pt-BR'
    historyRetentionDays: 0,    // 0 = keep forever (default); otherwise auto-prune older entries
    counterPositionX: null,     // % of viewport width; null = default bottom-right corner
    counterPositionY: null,     // % of viewport height; null = default bottom-right corner
    trackWatchProgress: false,  // opt-in: mark as viewed after watching most of a video, even without a like/dislike
    watchProgressThreshold: 0.9, // fraction (0–1) of the video that must be watched to auto-mark as viewed
  };

  // Allowed watch-progress thresholds (fractions). Stored values are clamped to this set.
  const WATCH_PROGRESS_THRESHOLDS = [0.75, 0.8, 0.85, 0.9, 0.95];

  /**
   * Resolve badgeText and locale-aware defaults when loading settings.
   * @param {object} stored
   * @returns {object}
   */
  function normalizeSettings(stored) {
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    const locale = typeof YTCheckI18n !== 'undefined'
      ? YTCheckI18n.resolveLocale(merged.locale)
      : (merged.locale === 'pt-BR' ? 'pt-BR' : 'en');

    if (!merged.badgeText || YTCheckI18n?.isDefaultBadgeText(merged.badgeText)) {
      merged.badgeText = typeof YTCheckI18n !== 'undefined'
        ? YTCheckI18n.getDefaultBadgeText(locale)
        : (locale === 'pt-BR' ? '✓ Visualizado' : '✓ Viewed');
    }

    // Guard against out-of-range / legacy values from storage
    if (!WATCH_PROGRESS_THRESHOLDS.includes(merged.watchProgressThreshold)) {
      merged.watchProgressThreshold = DEFAULT_SETTINGS.watchProgressThreshold;
    }

    return merged;
  }

  // ─── VIDEO STORAGE (chrome.storage.local) ────────────────────────────────────

  /**
   * Retrieve a single video record by videoId.
   * @param {string} videoId
   * @returns {Promise<object|null>}
   */
  async function getVideo(videoId) {
    return safeStorage((resolve) => {
      chrome.storage.local.get(['videos'], (result) => {
        const videos = result.videos || {};
        resolve(videos[videoId] || null);
      });
    }, null);
  }

  /**
   * Persist or update a video record.
   * @param {object} videoData
   * @returns {Promise<void>}
   */
  async function saveVideo(videoData) {
    const { videoId } = videoData;
    if (!videoId) return;

    return safeStorage((resolve) => {
      chrome.storage.local.get(['videos'], (result) => {
        const videos = result.videos || {};
        const existing = videos[videoId] || {};
        const liked = videoData.liked !== undefined ? videoData.liked : !!existing.liked;
        const disliked = videoData.disliked !== undefined ? videoData.disliked : !!existing.disliked;
        const watchedByProgress = videoData.watchedByProgress !== undefined
          ? videoData.watchedByProgress
          : !!existing.watchedByProgress;

        videos[videoId] = {
          ...existing,
          ...videoData,
          liked,
          disliked,
          watchedByProgress,
          viewed: !!(liked || disliked || watchedByProgress),
          updatedAt: Date.now(),
        };
        chrome.storage.local.set({ videos }, resolve);
      });
    });
  }

  /**
   * Retrieve all stored video records.
   * @returns {Promise<object>} Map of videoId -> videoData
   */
  async function getAllVideos() {
    return safeStorage((resolve) => {
      chrome.storage.local.get(['videos'], (result) => {
        resolve(result.videos || {});
      });
    }, {});
  }

  /**
   * Get only the set of viewed video IDs for fast lookup.
   * @returns {Promise<Set<string>>}
   */
  async function getViewedIds() {
    const videos = await getAllVideos();
    const ids = new Set();
    for (const [id, data] of Object.entries(videos)) {
      if (data.viewed) ids.add(id);
    }
    return ids;
  }

  /**
   * Delete all stored video records.
   * @returns {Promise<void>}
   */
  async function clearVideos() {
    return safeStorage((resolve) => {
      chrome.storage.local.set({ videos: {} }, resolve);
    });
  }

  /**
   * Delete a single video record by videoId (e.g. "remove from history").
   * @param {string} videoId
   * @returns {Promise<void>}
   */
  async function deleteVideo(videoId) {
    if (!videoId) return;
    return safeStorage((resolve) => {
      chrome.storage.local.get(['videos'], (result) => {
        const videos = result.videos || {};
        delete videos[videoId];
        chrome.storage.local.set({ videos }, resolve);
      });
    });
  }

  /**
   * Remove video records last updated before the retention window.
   * No-op when retentionDays is 0/falsy (retention disabled).
   * @param {number} retentionDays
   * @returns {Promise<number>} number of records removed
   */
  async function pruneOldVideos(retentionDays) {
    if (!retentionDays || retentionDays <= 0) return 0;

    return safeStorage((resolve) => {
      chrome.storage.local.get(['videos'], (result) => {
        const videos = result.videos || {};
        const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        let removed = 0;

        for (const [id, data] of Object.entries(videos)) {
          if ((data.updatedAt || 0) < cutoff) {
            delete videos[id];
            removed++;
          }
        }

        if (removed === 0) {
          resolve(0);
          return;
        }
        chrome.storage.local.set({ videos }, () => resolve(removed));
      });
    }, 0);
  }

  /**
   * Export all videos as a JSON string.
   * @returns {Promise<string>}
   */
  async function exportVideos() {
    const videos = await getAllVideos();
    return JSON.stringify({ exportedAt: Date.now(), videos }, null, 2);
  }

  /**
   * Import videos from a JSON string (merges with existing data).
   * `reason` tells apart a malformed JSON file ('parse') from valid JSON that
   * isn't a video map ('format'), so callers can show the right message.
   * @param {string} jsonString
   * @returns {Promise<{imported: number, errors: number, reason: string|null}>}
   */
  async function importVideos(jsonString) {
    return safeStorage((resolve) => {
      let imported = 0;
      let errors = 0;

      let incoming;
      try {
        const parsed = JSON.parse(jsonString);
        incoming = parsed?.videos || parsed;
      } catch {
        resolve({ imported: 0, errors: 1, reason: 'parse' });
        return;
      }

      // A video map is a plain object keyed by videoId — arrays and null are not.
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        resolve({ imported: 0, errors: 1, reason: 'format' });
        return;
      }

      chrome.storage.local.get(['videos'], (result) => {
        const videos = result.videos || {};
        for (const [id, data] of Object.entries(incoming)) {
          if (!id || !data || typeof data !== 'object' || Array.isArray(data)) {
            errors++;
            continue;
          }

          const existing = videos[id] || {};
          const merged = { ...existing, ...data };

          videos[id] = {
            ...merged,
            videoId: merged.videoId || id,
            // Same derivation as saveVideo — never trust an incoming `viewed`.
            viewed: !!(merged.liked || merged.disliked || merged.watchedByProgress),
            // Without a timestamp the record would look infinitely old and be
            // wiped by the first retention prune.
            updatedAt: merged.updatedAt || Date.now(),
          };
          imported++;
        }
        chrome.storage.local.set({ videos }, () => {
          resolve({ imported, errors, reason: imported === 0 ? 'format' : null });
        });
      });
    }, { imported: 0, errors: 1, reason: 'format' });
  }

  /**
   * Get statistics summary.
   * @returns {Promise<{total: number, liked: number, disliked: number, viewed: number}>}
   */
  async function getStats() {
    const videos = await getAllVideos();
    const entries = Object.values(videos);
    return {
      total: entries.length,
      liked: entries.filter((v) => v.liked).length,
      disliked: entries.filter((v) => v.disliked).length,
      viewed: entries.filter((v) => v.viewed).length,
    };
  }

  // ─── SETTINGS STORAGE (chrome.storage.sync) ──────────────────────────────────

  /**
   * Retrieve current settings, merged with defaults.
   * @returns {Promise<object>}
   */
  async function getSettings() {
    return safeStorage((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        resolve(normalizeSettings(result.settings || {}));
      });
    }, normalizeSettings({}));
  }

  /**
   * Persist settings (partial update supported).
   * @param {object} partialSettings
   * @returns {Promise<void>}
   */
  async function saveSettings(partialSettings) {
    const current = await getSettings();
    return safeStorage((resolve) => {
      chrome.storage.sync.set({ settings: { ...current, ...partialSettings } }, resolve);
    });
  }

  /**
   * Reset settings to defaults.
   * @returns {Promise<void>}
   */
  async function resetSettings() {
    const locale = typeof YTCheckI18n !== 'undefined' ? YTCheckI18n.getLocale() : 'en';
    const reset = {
      ...DEFAULT_SETTINGS,
      badgeText: typeof YTCheckI18n !== 'undefined'
        ? YTCheckI18n.getDefaultBadgeText(locale)
        : '✓ Viewed',
    };
    return safeStorage((resolve) => {
      chrome.storage.sync.set({ settings: reset }, resolve);
    });
  }


  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  return {
    getVideo,
    saveVideo,
    getAllVideos,
    getViewedIds,
    clearVideos,
    deleteVideo,
    pruneOldVideos,
    exportVideos,
    importVideos,
    getStats,
    getSettings,
    saveSettings,
    resetSettings,
    DEFAULT_SETTINGS,
  };
})();
