/**
 * YouTube Check — Content Script
 * Main entry point injected into YouTube pages.
 * Orchestrates: video detection, like/dislike reading, badge injection, and storage.
 */

(async () => {
  // ─── STATE ────────────────────────────────────────────────────────────────────

  /** @type {WeakSet<Element>} DOM elements already processed to avoid duplicate badges */
  const processedElements = new WeakSet();

  /** @type {Set<string>} Video IDs confirmed as viewed */
  let viewedIds = new Set();

  /** @type {object} Current extension settings */
  let settings = await YTCheckStorage.getSettings();

  /** @type {MutationObserver|null} Observer for like/dislike buttons */
  let likeObserver = null;

  /** @type {number|null} Retry timer for like/dislike detection on watch pages */
  let likeDetectTimer = null;

  /** @type {MutationObserver|null} Watches active Short changes in the player feed */
  let shortsActiveObserver = null;

  /** @type {number|null} Polls URL changes while browsing Shorts */
  let shortsUrlPollTimer = null;

  /** @type {boolean} Whether Shorts click capture is registered */
  let shortsClickCaptureBound = false;

  /** @type {number|null} Retries bootstrap until Shorts UI is ready (F5) */
  let shortsBootstrapTimer = null;

  /** @type {string|null} Last video ID we fully set up detection for */
  let _lastHandledVideoId = null;

  /** @type {string|null} Last URL seen by Shorts poller */
  let _lastShortsUrl = null;

  /** @type {boolean} Shorts monitoring listeners are active */
  let shortsMonitoringActive = false;

  /** @type {Set<string>} Shorts seen in the current player session (scroll feed) */
  let shortsSessionIds = new Set();

  // ─── CONTEXT GUARD ───────────────────────────────────────────────────────────

  /**
   * Returns false if the extension has been reloaded/unloaded (context invalidated).
   * Prevents uncaught errors on stale content scripts.
   */
  function isContextAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  // ─── INITIALIZATION ───────────────────────────────────────────────────────────

  async function init() {
    if (!isContextAlive()) return;

    try {
      // Set up navigation & message listeners BEFORE first page handling
      YTDomObserver.watchNavigation(handlePageChange);
      chrome.runtime.onMessage.addListener(onMessage);
      chrome.storage.onChanged.addListener(onStorageChanged);

      // Load all viewed IDs from storage for fast lookups
      viewedIds = await YTCheckStorage.getViewedIds();

      // Start observing the page for new video elements (always, guard in callback)
      YTDomObserver.start(onNewElements, YTParser.VIDEO_ELEMENTS_SELECTOR);

      // Initial badge pass
      if (settings.enabled) {
        processAllVisibleVideos();
      }

      // Handle current page (might be a watch page)
      handlePageChange(window.location.href);

      if (YTParser.isShortsPlayer()) {
        startShortsMonitoring();
      }
    } catch (err) {
      // Context may have been invalidated during async init — fail silently
      if (!isContextAlive()) return;
      console.warn('[YouTube Check] Init error:', err);
    }
  }


  // ─── PAGE CHANGE HANDLER ─────────────────────────────────────────────────────

  let _navTimer = null;
  let _pendingUrl = null;

  /**
   * Called on initial load and on every SPA navigation.
   * Debounced to prevent rapid-fire processing from multiple navigation events.
   * @param {string} url
   */
  function handlePageChange(url) {
    _pendingUrl = url;
    if (_navTimer) return;
    _navTimer = setTimeout(async () => {
      _navTimer = null;
      const targetUrl = _pendingUrl;
      _pendingUrl = null;

      await _executePageChange(targetUrl);
    }, 300);
  }

  /**
   * Internal: execute the page change logic.
   * @param {string} url
   */
  async function _executePageChange(url) {
    settings = await YTCheckStorage.getSettings();

    const videoId = YTParser.extractVideoId(url);
    const isShorts = YTParser.isShortsPlayer();
    const videoChanged = videoId !== _lastHandledVideoId;

    if (isShorts) {
      startShortsMonitoring();

      if (videoChanged) {
        _lastHandledVideoId = videoId;
        onShortsVideoChanged();
      }
    } else {
      stopShortsMonitoring();

      cleanupLikeObserver();
      removeWatchIndicator();
      _lastHandledVideoId = videoId;

      if (YTParser.isWatchPage()) {
        scheduleLikeDetection();
        scheduleWatchIndicatorCheck();
      }
    }

    setTimeout(() => {
      if (settings.enabled) {
        processAllVisibleVideos();
      }
    }, 600);
  }

  // ─── SHORTS PLAYER MONITORING ────────────────────────────────────────────────

  /**
   * Central entry: wire URL polling, click capture, DOM observer and bootstrap retry.
   */
  function startShortsMonitoring() {
    if (!YTParser.isShortsPlayer()) return;

    if (!shortsMonitoringActive) {
      shortsMonitoringActive = true;
      bindShortsClickCapture();
      startShortsUrlPolling();
      document.addEventListener('yt-navigate-finish', onShortsNavigateFinish);
      window.addEventListener('load', onShortsNavigateFinish);
    }

    ensureShortsLikeObserver();
    bootstrapShortsPlayer();
  }

  function onShortsNavigateFinish() {
    if (!YTParser.isShortsPlayer()) return;
    bootstrapShortsPlayer();
    onShortsVideoChanged();
  }

  function stopShortsMonitoring() {
    if (!shortsMonitoringActive) return;
    shortsMonitoringActive = false;
    shortsSessionIds.clear();

    stopShortsUrlPolling();
    cleanupShortsActiveObserver();
    document.removeEventListener('yt-navigate-finish', onShortsNavigateFinish);
    window.removeEventListener('load', onShortsNavigateFinish);
    if (shortsBootstrapTimer) {
      clearTimeout(shortsBootstrapTimer);
      shortsBootstrapTimer = null;
    }
    if (likeObserver) {
      likeObserver.disconnect();
      likeObserver = null;
    }
  }

  /**
   * Called when the active Short changes (scroll) or on first load.
   */
  function onShortsVideoChanged() {
    const videoId = YTParser.getCurrentShortsVideoId();
    if (videoId) {
      _lastHandledVideoId = videoId;
      trackShortsInSession();
    }

    removeWatchIndicator();
    ensureShortsLikeObserver();
    syncShortsLikeState();
    scheduleWatchIndicatorCheck();

    if (settings.enabled) {
      processAllVisibleVideos();
      scheduleCounterUpdate();
    }
  }

  /**
   * Register every Short visible in the feed + current URL for session counter.
   */
  function trackShortsInSession() {
    const currentId = YTParser.getCurrentShortsVideoId();
    if (currentId) shortsSessionIds.add(currentId);

    for (const reel of document.querySelectorAll('ytd-reel-video-renderer')) {
      const data = YTParser.extractFromElement(reel);
      if (data?.videoId) {
        shortsSessionIds.add(data.videoId);
        reel.dataset.ytcheckId = data.videoId;
      }
    }
  }

  /**
   * Count viewed/total for the Shorts player session.
   * @returns {{ total: number, viewed: number }}
   */
  function getShortsSessionCounts() {
    trackShortsInSession();

    let viewed = 0;
    for (const id of shortsSessionIds) {
      if (viewedIds.has(id)) viewed++;
    }

    return { total: shortsSessionIds.size, viewed };
  }

  /**
   * Read like/dislike for the current Short and persist.
   */
  async function syncShortsLikeState() {
    const state = YTParser.detectLikeDislikeState();
    if (state !== null) {
      await handleLikeDislikeState(state);
    }
  }

  /**
   * Retry until Shorts UI is mounted — fixes hard reload (F5).
   */
  function bootstrapShortsPlayer() {
    if (shortsBootstrapTimer) clearTimeout(shortsBootstrapTimer);

    let attempts = 0;
    const maxAttempts = 40;

    function attempt() {
      if (!YTParser.isShortsPlayer() || !isContextAlive()) return;

      attempts++;
      const root = YTParser.getShortsRoot();
      const state = YTParser.detectLikeDislikeState();
      const videoId = YTParser.getCurrentShortsVideoId();

      if (videoId) {
        _lastHandledVideoId = videoId;
        _lastShortsUrl = window.location.href;

        if (root) ensureShortsLikeObserver();

        if (state !== null) {
          handleLikeDislikeState(state);
        }
        scheduleWatchIndicatorCheck();

        if (settings.enabled) {
          processAllVisibleVideos();
          updatePageCounter();
        }

        if (root && state !== null) return;
      }

      if (attempts < maxAttempts) {
        shortsBootstrapTimer = setTimeout(attempt, 500);
      }
    }

    attempt();
  }

  function bindShortsClickCapture() {
    if (shortsClickCaptureBound) return;
    shortsClickCaptureBound = true;

    document.addEventListener('click', (event) => {
      if (!YTParser.isShortsPlayer() || !settings.enabled) return;

      const clickType = YTParser.getShortsRatingClickType(event.target);
      if (!clickType) return;

      // YouTube updates aria-pressed after the click handler runs
      setTimeout(() => syncShortsLikeState(), 400);
      setTimeout(() => syncShortsLikeState(), 900);
    }, true);
  }

  function startShortsUrlPolling() {
    if (shortsUrlPollTimer) return;

    _lastShortsUrl = window.location.href;
    _lastHandledVideoId = YTParser.getCurrentShortsVideoId();

    shortsUrlPollTimer = setInterval(() => {
      if (!YTParser.isShortsPlayer()) {
        stopShortsUrlPolling();
        return;
      }

      const href = window.location.href;
      const videoId = YTParser.getCurrentShortsVideoId();

      if (href !== _lastShortsUrl || videoId !== _lastHandledVideoId) {
        _lastShortsUrl = href;
        _lastHandledVideoId = videoId;
        onShortsVideoChanged();
      }
    }, 500);
  }

  function stopShortsUrlPolling() {
    if (shortsUrlPollTimer) {
      clearInterval(shortsUrlPollTimer);
      shortsUrlPollTimer = null;
    }
    _lastShortsUrl = null;
  }

  function ensureShortsLikeObserver() {
    const root = YTParser.getShortsRoot();
    if (!root) return;

    if (likeObserver) {
      likeObserver.disconnect();
      likeObserver = null;
    }

    likeObserver = YTDomObserver.observeAttributes(
      root,
      ['aria-pressed', 'is-toggled', 'class'],
      () => {
        if (likeObserver._debounce) clearTimeout(likeObserver._debounce);
        likeObserver._debounce = setTimeout(() => syncShortsLikeState(), 300);
      }
    );
  }

  function cleanupShortsActiveObserver() {
    if (shortsActiveObserver) {
      shortsActiveObserver.disconnect();
      shortsActiveObserver = null;
    }
  }

  // ─── LIKE/DISLIKE DETECTION (WATCH PAGE) ─────────────────────────────────────

  function scheduleLikeDetection() {
    if (likeDetectTimer) clearTimeout(likeDetectTimer);

    let attempts = 0;
    const maxAttempts = YTParser.isShortsPlayer() ? 20 : 8;

    function attempt() {
      attempts++;
      const state = YTParser.detectLikeDislikeState();

      if (state !== null) {
        handleLikeDislikeState(state);
        setupLikeObserver();
      } else if (attempts < maxAttempts) {
        likeDetectTimer = setTimeout(attempt, 600 * Math.min(attempts, 4));
      }
    }

    likeDetectTimer = setTimeout(attempt, YTParser.isShortsPlayer() ? 400 : 1200);
  }

  /**
   * Persist the like/dislike state for the current video.
   * @param {{ liked: boolean, disliked: boolean }} state
   */
  async function handleLikeDislikeState(state) {
    const videoId = YTParser.isShortsPlayer()
      ? YTParser.getCurrentShortsVideoId()
      : YTParser.getCurrentVideoId();

    if (!videoId) return;

    const title = YTParser.isShortsPlayer()
      ? (YTParser.extractFromShortsPlayer()?.title || document.title.replace(' - YouTube', '').trim())
      : document.title.replace(' - YouTube', '').trim();
    const existing = await YTCheckStorage.getVideo(videoId);

    // Avoid unnecessary writes if nothing changed
    if (
      existing &&
      existing.liked === state.liked &&
      existing.disliked === state.disliked
    ) {
      updateWatchIndicator(state.liked, state.disliked);
      if (settings.enabled) scheduleCounterUpdate();
      return;
    }

    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const channelEl = YTParser.isShortsPlayer()
      ? (document.querySelector('ytd-reel-video-renderer[is-active] ytd-channel-name') ||
         document.querySelector('ytd-reel-video-renderer[is-active] #channel-name'))
      : (document.querySelector('ytd-video-owner-renderer #channel-name yt-formatted-string') ||
         document.querySelector('#owner #channel-name'));
    const channel = channelEl ? channelEl.textContent.trim() : '';

    await YTCheckStorage.saveVideo({
      videoId,
      title,
      channel,
      thumbnail,
      url: window.location.href,
      liked: state.liked,
      disliked: state.disliked,
    });

    // Update local cache
    if (state.liked || state.disliked) {
      viewedIds.add(videoId);
    } else {
      viewedIds.delete(videoId);
    }

    if (YTParser.isShortsPlayer()) {
      shortsSessionIds.add(videoId);
    }

    // Update watch page indicator with fresh state
    updateWatchIndicator(state.liked, state.disliked);
    if (settings.enabled) scheduleCounterUpdate();
  }

  // ─── WATCH PAGE INDICATOR ─────────────────────────────────────────────────────

  let _watchIndicatorEl = null;
  let _watchIndicatorTimer = null;

  /**
   * Check storage and show indicator if current video was already rated.
   * Called on page navigation to catch videos rated in a previous session.
   */
  function scheduleWatchIndicatorCheck() {
    if (_watchIndicatorTimer) clearTimeout(_watchIndicatorTimer);
    _watchIndicatorTimer = setTimeout(async () => {
      const videoId = YTParser.isShortsPlayer()
        ? YTParser.getCurrentShortsVideoId()
        : YTParser.getCurrentVideoId();
      if (!videoId) return;
      const record = await YTCheckStorage.getVideo(videoId);
      if (record && record.viewed) {
        updateWatchIndicator(record.liked, record.disliked);
      }
    }, 1500);
  }

  /**
   * Inject or update the watch page indicator pill.
   * @param {boolean} liked
   * @param {boolean} disliked
   */
  function updateWatchIndicator(liked, disliked) {
    if (!settings.enabled) return;
    if (!YTParser.isWatchPage() && !YTParser.isShortsPlayer()) return;

    const isViewed = liked || disliked;

    if (!isViewed) {
      removeWatchIndicator();
      return;
    }

    const isShorts = YTParser.isShortsPlayer();
    let anchor = null;

    if (isShorts) {
      anchor =
        document.querySelector('ytd-reel-video-renderer[is-active] #overlay') ||
        document.querySelector('ytd-reel-video-renderer[is-active] .metadata-container') ||
        document.querySelector('ytd-reel-video-renderer[is-active]');
    } else {
      anchor =
        document.querySelector('#above-the-fold') ||
        document.querySelector('#title.ytd-watch-metadata') ||
        document.querySelector('ytd-watch-metadata') ||
        document.querySelector('#info-contents') ||
        document.querySelector('#primary-inner');
    }

    if (!anchor) return;

    if (!_watchIndicatorEl || !_watchIndicatorEl.isConnected || _watchIndicatorEl.parentElement !== anchor) {
      if (_watchIndicatorEl) _watchIndicatorEl.remove();
      _watchIndicatorEl = document.createElement('div');
      _watchIndicatorEl.id = 'ytcheck-watch-indicator';
      // Insert as first child of the anchor section
      anchor.insertAdjacentElement('afterbegin', _watchIndicatorEl);
    }

    const icon   = liked ? '👍' : '👎';
    const label  = liked ? 'Curtido' : 'Não curtido';
    const cls    = liked ? 'ytcheck-watch--liked' : 'ytcheck-watch--disliked';
    const shortsCls = isShorts ? 'ytcheck-shorts-player-indicator' : '';

    _watchIndicatorEl.className = `ytcheck-watch-indicator ${cls} ${shortsCls}`;
    _watchIndicatorEl.style.setProperty('--ytcheck-color', settings.badgeColor);
    _watchIndicatorEl.innerHTML = `
      <span class="ytcheck-watch-check">✓</span>
      <span class="ytcheck-watch-text">Você já avaliou este vídeo</span>
      <span class="ytcheck-watch-pill">${icon} ${label}</span>
    `;
  }

  function removeWatchIndicator() {
    if (_watchIndicatorEl) {
      _watchIndicatorEl.remove();
      _watchIndicatorEl = null;
    }
    if (_watchIndicatorTimer) {
      clearTimeout(_watchIndicatorTimer);
      _watchIndicatorTimer = null;
    }
  }

  /**
   * Set up a MutationObserver to watch for like/dislike button changes.
   */
  function setupLikeObserver() {
    if (YTParser.isShortsPlayer()) {
      ensureShortsLikeObserver();
      return;
    }

    const container =
      document.querySelector('ytd-segmented-like-dislike-button-renderer') ||
      document.querySelector('segmented-like-dislike-button-view-model') ||
      document.querySelector('#top-level-buttons-computed') ||
      document.querySelector('ytd-menu-renderer');

    if (!container) return;

    if (likeObserver) {
      likeObserver.disconnect();
      likeObserver = null;
    }

    likeObserver = YTDomObserver.observeAttributes(
      container,
      ['aria-pressed', 'is-toggled', 'class'],
      () => {
        // Debounce: wait 300ms after last change
        if (likeObserver._debounce) clearTimeout(likeObserver._debounce);
        likeObserver._debounce = setTimeout(async () => {
          const state = YTParser.detectLikeDislikeState();
          if (state !== null) await handleLikeDislikeState(state);
        }, 300);
      }
    );
  }

  function cleanupLikeObserver() {
    if (likeObserver) {
      likeObserver.disconnect();
      likeObserver = null;
    }
    if (likeDetectTimer) {
      clearTimeout(likeDetectTimer);
      likeDetectTimer = null;
    }
  }

  // ─── VIDEO LISTING PROCESSING ─────────────────────────────────────────────────

  /**
   * Process all currently visible video cards in the DOM.
   */
  function processAllVisibleVideos() {
    const selector = YTParser.isShortsPlayer()
      ? `${YTParser.VIDEO_ELEMENTS_SELECTOR},ytd-reel-video-renderer`
      : YTParser.VIDEO_ELEMENTS_SELECTOR;

    const elements = document.querySelectorAll(selector);
    const toProcess = [];
    for (const el of elements) {
      const data = YTParser.extractFromElement(el);
      if (!data) continue;
      if (processedElements.has(el) && el.dataset.ytcheckId === data.videoId) continue;
      toProcess.push(el);
    }
    if (toProcess.length > 0) {
      processVideoElements(toProcess);
    } else {
      scheduleCounterUpdate();
    }
  }

  /**
   * Called by MutationObserver with newly inserted elements.
   * @param {Element[]} elements
   */
  function onNewElements(elements) {
    if (!settings.enabled) return;
    const unprocessed = elements.filter((el) => !processedElements.has(el));
    if (unprocessed.length > 0) {
      processVideoElements(unprocessed);
    }
  }

  /**
   * Process a batch of video card elements.
   * @param {Element[]} elements
   */
  function processVideoElements(elements) {
    for (const el of elements) {
      const data = YTParser.extractFromElement(el);
      if (!data) continue;

      const alreadyProcessed =
        processedElements.has(el) &&
        el.dataset.ytcheckId === data.videoId;

      if (alreadyProcessed) continue;

      // Shorts feed reuses reel nodes — clear stale badge when video ID changes
      if (processedElements.has(el) && el.dataset.ytcheckId !== data.videoId) {
        removeBadgeFromElement(el);
      }

      processedElements.add(el);

      // Apply visual badge if video is viewed
      if (viewedIds.has(data.videoId)) {
        applyBadge(el, data.videoId);
      } else {
        // Mark element with the video ID so we can find it later
        el.dataset.ytcheckId = data.videoId;
      }

      // Apply hide/highlight settings
      applyVisibilitySettings(el, data.videoId);
    }
    // Update page counter after processing
    scheduleCounterUpdate();
  }

  // ─── BADGE / OVERLAY INJECTION ────────────────────────────────────────────────

  /**
   * Inject the viewed badge into a video card element.
   * @param {Element} el
   * @param {string} videoId
   */
  function applyBadge(el, videoId) {
    if (!settings.enabled) return;

    // Avoid duplicate badges
    if (el.querySelector('.ytcheck-badge, .ytcheck-overlay')) return;

    el.dataset.ytcheckId = videoId;
    el.dataset.ytcheckViewed = 'true';

    const thumbContainer = YTParser.getThumbnailContainer(el);
    if (!thumbContainer) return;

    // Ensure thumbnail container is position:relative
    const currentPos = getComputedStyle(thumbContainer).position;
    if (currentPos === 'static') {
      thumbContainer.style.position = 'relative';
    }

    if (settings.displayMode === 'overlay') {
      applyOverlay(thumbContainer, videoId);
    } else {
      applyBadgeElement(thumbContainer, videoId);
    }

    // Apply hide setting
    applyVisibilitySettings(el, videoId);
  }

  function applyBadgeElement(container, videoId) {
    const badge = document.createElement('div');
    badge.className = 'ytcheck-badge';
    badge.textContent = settings.badgeText;
    badge.style.setProperty('--ytcheck-color', settings.badgeColor);
    badge.setAttribute('data-video-id', videoId);
    container.appendChild(badge);
  }

  function applyOverlay(container, videoId) {
    const overlay = document.createElement('div');
    overlay.className = 'ytcheck-overlay';
    overlay.style.setProperty('--ytcheck-color', settings.badgeColor);
    overlay.setAttribute('data-video-id', videoId);

    const label = document.createElement('span');
    label.className = 'ytcheck-overlay-label';
    label.textContent = settings.badgeText;
    overlay.appendChild(label);

    container.appendChild(overlay);
  }

  /**
   * Apply hide/highlight based on settings.
   * @param {Element} el
   * @param {string} videoId
   */
  function applyVisibilitySettings(el, videoId) {
    const isViewed = viewedIds.has(videoId);

    if (settings.hideViewed && isViewed) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.height = '0';
      el.style.overflow = 'hidden';
      el.style.margin = '0';
      el.style.padding = '0';
    }

    if (settings.highlightUnviewed && !isViewed) {
      el.style.outline = `2px solid ${settings.badgeColor}`;
      el.style.borderRadius = '8px';
    }
  }

  function removeBadgeFromElement(el) {
    el.querySelectorAll('.ytcheck-badge, .ytcheck-overlay').forEach((badge) => badge.remove());
    delete el.dataset.ytcheckViewed;
    el.style.opacity = '';
    el.style.pointerEvents = '';
    el.style.height = '';
    el.style.overflow = '';
    el.style.margin = '';
    el.style.padding = '';
    el.style.outline = '';
    el.style.borderRadius = '';
  }

  /**
   * Remove all ytcheck badges/overlays from the DOM.
   */
  function removeAllBadges() {
    document.querySelectorAll('.ytcheck-badge, .ytcheck-overlay').forEach((el) => el.remove());
    document.querySelectorAll('[data-ytcheck-viewed]').forEach((el) => {
      delete el.dataset.ytcheckViewed;
    });
  }

  /**
   * Re-apply all badges to currently visible videos (after settings change or refresh).
   */
  async function refreshAllBadges() {
    removeAllBadges();
    viewedIds = await YTCheckStorage.getViewedIds();
    settings = await YTCheckStorage.getSettings();

    if (!settings.enabled) return;

    const elements = document.querySelectorAll('[data-ytcheck-id]');
    for (const el of elements) {
      const videoId = el.dataset.ytcheckId;
      if (videoId && viewedIds.has(videoId)) {
        applyBadge(el, videoId);
      }
    }

    // Also re-scan all visible (some might not have been tagged yet)
    processAllVisibleVideos();
  }

  // ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────

  /**
   * Handle messages from popup or background.
   * @param {object} message
   * @param {object} sender
   * @param {function} sendResponse
   */
  function onMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'refresh':
        refreshAllBadges().then(() => sendResponse({ ok: true }));
        return true;

      case 'getStats':
        YTCheckStorage.getStats().then((stats) => sendResponse(stats));
        return true;

      case 'clearHistory':
        YTCheckStorage.clearVideos().then(async () => {
          viewedIds.clear();
          removeAllBadges();
          sendResponse({ ok: true });
        });
        return true;

      case 'settingsChanged':
        refreshAllBadges().then(() => sendResponse({ ok: true }));
        return true;

      case 'ping':
        sendResponse({ ok: true });
        return false;

      default:
        return false;
    }
  }

  // ─── STORAGE CHANGE LISTENER ──────────────────────────────────────────────────

  function onStorageChanged(changes, area) {
    if (area === 'sync' && changes.settings) {
      refreshAllBadges();
    }
    if (area === 'local' && changes.videos) {
      // Re-sync viewed IDs
      YTCheckStorage.getViewedIds().then((ids) => {
        viewedIds = ids;
        // Apply or remove badges for viewed/un-viewed videos
        document.querySelectorAll('[data-ytcheck-id]').forEach((el) => {
          const videoId = el.dataset.ytcheckId;
          if (videoId) {
            const isViewed = viewedIds.has(videoId);
            if (isViewed && !el.dataset.ytcheckViewed) {
              applyBadge(el, videoId);
            } else if (!isViewed && el.dataset.ytcheckViewed) {
              removeBadgeFromElement(el);
            }
          }
        });
        updatePageCounter();
      });
    }
  }

  // ─── PAGE COUNTER WIDGET ─────────────────────────────────────────────────────

  let _counterEl = null;
  let _counterTimer = null;

  /**
   * Create or update the floating counter showing viewed/total on the current page.
   */
  function updatePageCounter() {
    if (!settings.enabled || settings.showPageCounter === false) {
      removePageCounter();
      return;
    }

    let total = 0;
    let viewed = 0;

    // Shorts: count all videos seen while scrolling this feed
    if (YTParser.isShortsPlayer()) {
      const counts = getShortsSessionCounts();
      total = counts.total;
      viewed = counts.viewed;

      if (total === 0) {
        removePageCounter();
        return;
      }
    } else {
      const allCards = document.querySelectorAll(YTParser.VIDEO_ELEMENTS_SELECTOR);
      if (allCards.length === 0) {
        removePageCounter();
        return;
      }

      for (const card of allCards) {
        let videoId = card.dataset.ytcheckId;
        if (!videoId) {
          const data = YTParser.extractFromElement(card);
          if (!data) continue;
          videoId = data.videoId;
          card.dataset.ytcheckId = videoId;
        }
        total++;
        if (viewedIds.has(videoId)) viewed++;
      }
    }

    if (total === 0) {
      removePageCounter();
      return;
    }

    // Create counter element if it doesn't exist or is detached
    if (!_counterEl || !_counterEl.isConnected) {
      if (_counterEl) _counterEl.remove();
      _counterEl = document.createElement('div');
      _counterEl.id = 'ytcheck-page-counter';
      document.body.appendChild(_counterEl);
    }

    const pct = Math.round((viewed / total) * 100);
    _counterEl.innerHTML = `
      <div class="ytcheck-counter-inner">
        <span class="ytcheck-counter-check">✓</span>
        <div class="ytcheck-counter-text">
          <span class="ytcheck-counter-nums">${viewed}<span class="ytcheck-counter-sep">/</span>${total}</span>
          <span class="ytcheck-counter-label">vistos nesta página</span>
        </div>
        <div class="ytcheck-counter-ring" style="--pct:${pct}">
          <svg viewBox="0 0 36 36">
            <circle class="ytcheck-ring-bg" cx="18" cy="18" r="15.9" />
            <circle class="ytcheck-ring-fill" cx="18" cy="18" r="15.9"
              stroke-dasharray="${pct} ${100 - pct}"
              stroke-dashoffset="25" />
          </svg>
          <span class="ytcheck-ring-pct">${pct}%</span>
        </div>
      </div>
    `;
    _counterEl.style.setProperty('--ytcheck-color', settings.badgeColor);
  }

  function removePageCounter() {
    if (_counterEl) {
      _counterEl.remove();
      _counterEl = null;
    }
  }

  /**
   * Schedule a debounced counter update after processing elements.
   */
  function scheduleCounterUpdate() {
    if (_counterTimer) clearTimeout(_counterTimer);
    _counterTimer = setTimeout(updatePageCounter, 400);
  }

  // ─── START ───────────────────────────────────────────────────────────────────
  init();
})();

