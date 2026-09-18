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
   * Resolves with the fallback value if context is gone or the call fails
   * (an invalidated context makes the promise-based API reject mid-call).
   * @param {function(): Promise<*>} fn
   * @param {*} fallback - value to resolve with when context is invalid
   */
  async function safeStorage(fn, fallback = undefined) {
    if (!isContextValid()) return fallback;
    try {
      return await fn();
    } catch {
      return fallback;
    }
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
    fullTitle: false,           // opt-in: show the full video title on cards instead of YouTube's 2-line clamp
    locale: 'auto',             // 'auto' | 'en' | 'pt-BR'
    historyRetentionDays: 0,    // 0 = keep forever (default); otherwise auto-prune older entries
    counterPositionX: null,     // % of viewport width; null = default bottom-right corner
    counterPositionY: null,     // % of viewport height; null = default bottom-right corner
    trackWatchProgress: true,   // mark as viewed after watching most of a video, even without a like/dislike
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
    // `?.` alone doesn't guard an undeclared global — it still throws a ReferenceError.
    const i18n = typeof YTCheckI18n !== 'undefined' ? YTCheckI18n : null;
    const locale = i18n
      ? i18n.resolveLocale(merged.locale)
      : (merged.locale === 'pt-BR' ? 'pt-BR' : 'en');

    if (!merged.badgeText || i18n?.isDefaultBadgeText(merged.badgeText)) {
      merged.badgeText = i18n
        ? i18n.getDefaultBadgeText(locale)
        : (locale === 'pt-BR' ? '✓ Visualizado' : '✓ Viewed');
    }

    // Guard against out-of-range / legacy values from storage
    if (!WATCH_PROGRESS_THRESHOLDS.includes(merged.watchProgressThreshold)) {
      merged.watchProgressThreshold = DEFAULT_SETTINGS.watchProgressThreshold;
    }

    return merged;
  }

  // ─── VIDEO STORAGE (chrome.storage.local) ────────────────────────────────────
  //
  // One key per video (`video:<id>`), not one map holding every record. With a
  // single map each write rewrote the whole history, chrome.storage.onChanged
  // then shipped two full copies of it to every open YouTube tab, and two writes
  // landing together could erase each other. Per-video keys make a write touch —
  // and broadcast — a single record.

  const VIDEO_KEY_PREFIX = 'video:';

  /** Versions before 1.9.0 kept every record in this one `{ videoId: record }` map. */
  const LEGACY_VIDEOS_KEY = 'videos';

  const videoKey = (videoId) => VIDEO_KEY_PREFIX + videoId;
  const isVideoKey = (key) => key.startsWith(VIDEO_KEY_PREFIX);
  const videoIdFromKey = (key) => key.slice(VIDEO_KEY_PREFIX.length);

  /** @type {Promise<void>|null} */
  let _migration = null;

  /**
   * Move a pre-1.9.0 `videos` map into per-video keys. Runs once per context
   * (every video operation awaits it; after the first check it costs nothing)
   * and is safe to repeat: a record already under its own key is newer and
   * wins, and a crash between the copy and the removal just redoes the copy.
   * @returns {Promise<void>}
   */
  function migrateLegacyVideos() {
    if (!_migration) {
      _migration = (async () => {
        const { [LEGACY_VIDEOS_KEY]: legacy } = await chrome.storage.local.get(LEGACY_VIDEOS_KEY);
        if (legacy === undefined) return;

        if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
          const current = await chrome.storage.local.get(Object.keys(legacy).map(videoKey));
          const moved = {};
          for (const [id, record] of Object.entries(legacy)) {
            if (!record || typeof record !== 'object') continue;
            if (!current[videoKey(id)]) moved[videoKey(id)] = record;
          }
          if (Object.keys(moved).length > 0) await chrome.storage.local.set(moved);
        }

        await chrome.storage.local.remove(LEGACY_VIDEOS_KEY);
      })().catch((err) => {
        _migration = null; // let the next operation retry
        throw err;
      });
    }
    return _migration;
  }

  /**
   * Read-modify-write steps run one at a time within this context. Without it
   * a like and a watch-progress mark landing on the same video both read the
   * old record, and the second write erased the first. Across contexts only a
   * write to the very same video at the very same moment can still collide.
   */
  let _writeQueue = Promise.resolve();

  function queueWrite(task) {
    const run = _writeQueue.then(task);
    _writeQueue = run.catch(() => {});
    return run;
  }

  /**
   * Every stored video record, keyed by videoId.
   * @returns {Promise<object>}
   */
  async function readAllVideos() {
    await migrateLegacyVideos();
    const all = await chrome.storage.local.get(null);
    const videos = {};
    for (const [key, record] of Object.entries(all)) {
      if (isVideoKey(key)) videos[videoIdFromKey(key)] = record;
    }
    return videos;
  }

  /**
   * When a record became viewed — the date the period counters and the popup
   * history go by. Records written before 1.7.0 have no `viewedAt`; `updatedAt`
   * is the closest approximation available for them.
   * @param {object} record
   * @returns {number}
   */
  function getViewedAt(record) {
    return record?.viewedAt || record?.updatedAt || 0;
  }

  /**
   * Retrieve a single video record by videoId.
   * @param {string} videoId
   * @returns {Promise<object|null>}
   */
  async function getVideo(videoId) {
    if (!videoId) return null;
    return safeStorage(async () => {
      await migrateLegacyVideos();
      const key = videoKey(videoId);
      const result = await chrome.storage.local.get(key);
      return result[key] || null;
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

    return queueWrite(() => safeStorage(async () => {
      await migrateLegacyVideos();
      const key = videoKey(videoId);
      const existing = (await chrome.storage.local.get(key))[key] || {};
      const liked = videoData.liked !== undefined ? videoData.liked : !!existing.liked;
      const disliked = videoData.disliked !== undefined ? videoData.disliked : !!existing.disliked;
      const watchedByProgress = videoData.watchedByProgress !== undefined
        ? videoData.watchedByProgress
        : !!existing.watchedByProgress;
      const viewed = !!(liked || disliked || watchedByProgress);

      const record = {
        ...existing,
        ...videoData,
        liked,
        disliked,
        watchedByProgress,
        viewed,
        updatedAt: Date.now(),
        // Stamped once, when the record first becomes viewed — this is what the
        // period counters (today / week / month) read. `updatedAt` can't serve
        // that role: removing a like months later would move the video into
        // today's tally. Un-viewing clears it so a later re-rating re-stamps.
        viewedAt: viewed ? (existing.viewedAt || Date.now()) : undefined,
      };
      if (!viewed) delete record.viewedAt;

      await chrome.storage.local.set({ [key]: record });
    }));
  }

  /**
   * Retrieve all stored video records.
   * @returns {Promise<object>} Map of videoId -> videoData
   */
  async function getAllVideos() {
    return safeStorage(readAllVideos, {});
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
   * The video records touched by a `chrome.storage.onChanged` event for the
   * 'local' area — lets a listener apply exactly what changed instead of
   * reloading the whole history. `record` is null when the video was removed.
   * @param {object} changes
   * @returns {Array<{videoId: string, record: object|null}>}
   */
  function getVideoChanges(changes) {
    const result = [];
    for (const [key, change] of Object.entries(changes || {})) {
      if (!isVideoKey(key)) continue;
      result.push({ videoId: videoIdFromKey(key), record: change.newValue || null });
    }
    return result;
  }

  /**
   * Delete all stored video records.
   * @returns {Promise<void>}
   */
  async function clearVideos() {
    return queueWrite(() => safeStorage(async () => {
      const keys = Object.keys(await readAllVideos()).map(videoKey);
      if (keys.length > 0) await chrome.storage.local.remove(keys);
    }));
  }

  /**
   * Delete a single video record by videoId (e.g. "remove from history").
   * @param {string} videoId
   * @returns {Promise<void>}
   */
  async function deleteVideo(videoId) {
    if (!videoId) return;
    return queueWrite(() => safeStorage(async () => {
      await migrateLegacyVideos();
      await chrome.storage.local.remove(videoKey(videoId));
    }));
  }

  /**
   * Remove video records last updated before the retention window.
   * No-op when retentionDays is 0/falsy (retention disabled).
   *
   * Deliberately `updatedAt` (last activity), not `viewedAt`: a video viewed
   * long ago but re-rated yesterday is something the user just touched, and
   * pruning it would bring back the badge-less card they had just dealt with.
   * @param {number} retentionDays
   * @returns {Promise<number>} number of records removed
   */
  async function pruneOldVideos(retentionDays) {
    if (!retentionDays || retentionDays <= 0) return 0;

    return queueWrite(() => safeStorage(async () => {
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const stale = Object.entries(await readAllVideos())
        .filter(([, data]) => (data.updatedAt || 0) < cutoff)
        .map(([id]) => videoKey(id));

      if (stale.length > 0) await chrome.storage.local.remove(stale);
      return stale.length;
    }, 0));
  }

  /**
   * Export all videos as a JSON string. The file keeps the `{ videos: map }`
   * shape of every earlier version, so old and new backups import either way.
   * @returns {Promise<string>}
   */
  async function exportVideos() {
    const videos = await getAllVideos();
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      videos,
    }, null, 2);
  }

  /**
   * Import videos from a JSON string (merges with existing data).
   * `reason` tells apart a malformed JSON file ('parse') from valid JSON that
   * isn't a video map ('format'), so callers can show the right message.
   * @param {string} jsonString
   * @returns {Promise<{imported: number, errors: number, reason: string|null}>}
   */
  async function importVideos(jsonString) {
    let incoming;
    try {
      const parsed = JSON.parse(jsonString);
      incoming = parsed?.videos || parsed;
    } catch {
      return { imported: 0, errors: 1, reason: 'parse' };
    }

    // A video map is a plain object keyed by videoId — arrays and null are not.
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return { imported: 0, errors: 1, reason: 'format' };
    }

    return queueWrite(() => safeStorage(async () => {
      await migrateLegacyVideos();

      let imported = 0;
      let errors = 0;
      const valid = Object.entries(incoming).filter(([id, data]) => {
        const ok = id && data && typeof data === 'object' && !Array.isArray(data);
        if (!ok) errors++;
        return ok;
      });

      const current = await chrome.storage.local.get(valid.map(([id]) => videoKey(id)));
      const toWrite = {};

      for (const [id, data] of valid) {
        const existing = current[videoKey(id)] || {};
        const merged = { ...existing, ...data };
        // Same derivation as saveVideo — never trust an incoming `viewed`.
        const viewed = !!(merged.liked || merged.disliked || merged.watchedByProgress);
        // Without a timestamp the record would look infinitely old and be
        // wiped by the first retention prune.
        const updatedAt = merged.updatedAt || Date.now();

        const record = {
          ...merged,
          videoId: merged.videoId || id,
          viewed,
          updatedAt,
          // Backups written before viewedAt existed fall back to updatedAt, so
          // imported history still lands in the period counters.
          viewedAt: viewed ? (merged.viewedAt || updatedAt) : undefined,
        };
        if (!viewed) delete record.viewedAt;

        toWrite[videoKey(id)] = record;
        imported++;
      }

      if (imported > 0) await chrome.storage.local.set(toWrite);
      return { imported, errors, reason: imported === 0 ? 'format' : null };
    }, { imported: 0, errors: 1, reason: 'format' }));
  }

  /**
   * Calendar boundaries for the period counters, in local time: start of today,
   * of the current week (Monday) and of the current month.
   * @param {Date} [now]
   * @returns {{day: number, week: number, month: number}}
   */
  function getPeriodStarts(now = new Date()) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // getDay() is 0 for Sunday — treat it as the 7th day so the week starts Monday.
    const weekday = day.getDay() || 7;
    const week = new Date(day);
    week.setDate(day.getDate() - (weekday - 1));
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    return { day: day.getTime(), week: week.getTime(), month: month.getTime() };
  }

  /**
   * Get statistics summary. The period counts only include viewed videos, dated
   * by `getViewedAt`.
   * @param {object} [videos] records already loaded by the caller, to skip a
   *   second full read of the history
   * @returns {Promise<{total: number, liked: number, disliked: number, viewed: number,
   *   viewedToday: number, viewedThisWeek: number, viewedThisMonth: number}>}
   */
  async function getStats(videos) {
    const entries = Object.values(videos || await getAllVideos());
    const starts = getPeriodStarts();

    let viewedToday = 0;
    let viewedThisWeek = 0;
    let viewedThisMonth = 0;

    for (const v of entries) {
      if (!v.viewed) continue;
      const at = getViewedAt(v);
      if (at >= starts.day) viewedToday++;
      if (at >= starts.week) viewedThisWeek++;
      if (at >= starts.month) viewedThisMonth++;
    }

    return {
      total: entries.length,
      liked: entries.filter((v) => v.liked).length,
      disliked: entries.filter((v) => v.disliked).length,
      viewed: entries.filter((v) => v.viewed).length,
      viewedToday,
      viewedThisWeek,
      viewedThisMonth,
    };
  }

  // ─── SETTINGS STORAGE (chrome.storage.sync) ──────────────────────────────────

  /**
   * Retrieve current settings, merged with defaults.
   * @returns {Promise<object>}
   */
  async function getSettings() {
    return safeStorage(async () => {
      const { settings } = await chrome.storage.sync.get('settings');
      return normalizeSettings(settings || {});
    }, normalizeSettings({}));
  }

  /**
   * Persist settings (partial update supported).
   * @param {object} partialSettings
   * @returns {Promise<void>}
   */
  async function saveSettings(partialSettings) {
    const current = await getSettings();
    return safeStorage(() => chrome.storage.sync.set({ settings: { ...current, ...partialSettings } }));
  }


  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  return {
    getVideo,
    saveVideo,
    getAllVideos,
    getViewedIds,
    getViewedAt,
    getVideoChanges,
    migrateLegacyVideos: () => safeStorage(migrateLegacyVideos),
    clearVideos,
    deleteVideo,
    pruneOldVideos,
    exportVideos,
    importVideos,
    getStats,
    getSettings,
    saveSettings,
    DEFAULT_SETTINGS,
  };
})();
