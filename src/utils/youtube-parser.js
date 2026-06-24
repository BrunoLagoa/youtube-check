/**
 * YouTube Check — YouTube DOM Parser
 * Extracts video information from YouTube's DOM elements.
 */

const YTParser = (() => {

  // ─── VIDEO ID EXTRACTION ─────────────────────────────────────────────────────

  /**
   * Extract a video ID from a YouTube URL string or href attribute.
   * @param {string} url
   * @returns {string|null}
   */
  function extractVideoId(url) {
    if (!url) return null;
    try {
      // Handle /watch?v=ID format
      const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      if (watchMatch) return watchMatch[1];

      // Handle /shorts/ID format
      const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];

      // Handle /embed/ID format
      const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];

      // Handle youtu.be/ID format
      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (shortMatch) return shortMatch[1];

    } catch {
      return null;
    }
    return null;
  }

  /**
   * Get the current page's video ID (only on /watch pages).
   * @returns {string|null}
   */
  function getCurrentVideoId() {
    return extractVideoId(window.location.href);
  }

  /**
   * Determine if we're currently on a video watch page.
   * @returns {boolean}
   */
  function isWatchPage() {
    return window.location.pathname === '/watch';
  }

  /**
   * Determine if we're on a Shorts page.
   * @returns {boolean}
   */
  /**
   * Determine if we're on the Shorts PLAYER page (/shorts/VIDEO_ID).
   * This is like a watch page but for Shorts.
   * @returns {boolean}
   */
  function isShortsPlayer() {
    const path = window.location.pathname;
    // /shorts/ID has exactly 3 parts: ['', 'shorts', 'ID']
    const parts = path.split('/').filter(Boolean);
    return parts[0] === 'shorts' && parts.length >= 2 && parts[1].length > 0;
  }

  /**
   * Determine if we're on the Shorts shelf/listing page (/shorts without ID).
   * @returns {boolean}
   */
  function isShortsShelf() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] === 'shorts' && parts.length === 1;
  }

  /**
   * @deprecated Use isShortsPlayer() or isShortsShelf() instead.
   * Kept for backward compatibility.
   */
  function isShortsPage() {
    return isShortsPlayer() || isShortsShelf();
  }

  // ─── ELEMENT SELECTORS ───────────────────────────────────────────────────────

  /**
   * All YouTube video card element tag names to observe.
   */
  const VIDEO_ELEMENT_TAGS = [
    'ytd-rich-item-renderer',          // Home grid
    'ytd-video-renderer',              // Search results, sidebar
    'ytd-compact-video-renderer',      // Compact sidebar (watch page)
    'ytd-grid-video-renderer',         // Channel / Playlist grid
    'ytd-playlist-video-renderer',     // Playlist list view
    'ytd-reel-item-renderer',          // Shorts shelf items (home page shelf)
    'ytd-reel-video-renderer',         // Shorts player feed items
    'ytd-rich-grid-media',             // Home (inner)
    'ytm-video-with-context-renderer', // Mobile-like renderers
  ];

  /**
   * CSS selector that matches any YouTube video card element.
   */
  const VIDEO_ELEMENTS_SELECTOR = VIDEO_ELEMENT_TAGS.join(',');

  /**
   * Selectors for elements INSIDE the Shorts full-screen player (`/shorts/ID`).
   * Each reel video is a separate `ytd-reel-video-renderer`.
   */
  const SHORTS_PLAYER_SELECTOR = 'ytd-reel-video-renderer';

  // ─── DATA EXTRACTION FROM ELEMENTS ──────────────────────────────────────────

  /**
   * Returns the currently active Short in the full-screen player.
   * @returns {Element|null}
   */
  function getShortsRoot() {
    return (
      document.querySelector('ytd-shorts') ||
      document.querySelector('#shorts-container') ||
      document.querySelector('ytd-app[is-shorts]') ||
      null
    );
  }

  function getActiveShortsReel() {
    const byAttr =
      document.querySelector('ytd-reel-video-renderer[is-active]') ||
      document.querySelector('ytd-shorts ytd-reel-video-renderer[is-active]');
    if (byAttr) return byAttr;

    const currentId = getCurrentVideoId();
    if (currentId) {
      for (const reel of document.querySelectorAll('ytd-reel-video-renderer')) {
        const data = _extractFromReelRenderer(reel);
        if (data?.videoId === currentId) return reel;
      }
    }

    return _findReelInViewport();
  }

  function _findReelInViewport() {
    const mid = window.innerHeight / 2;
    let best = null;
    let bestOverlap = 0;

    for (const reel of document.querySelectorAll('ytd-reel-video-renderer')) {
      const rect = reel.getBoundingClientRect();
      const overlap = Math.min(rect.bottom, mid + rect.height / 2) - Math.max(rect.top, mid - rect.height / 2);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = reel;
      }
    }

    return best;
  }

  /**
   * Current Short video ID — URL is the source of truth in the player.
   * @returns {string|null}
   */
  function getCurrentShortsVideoId() {
    return getCurrentVideoId();
  }

  /**
   * Given a YouTube video card element, extract its video data.
   * @param {Element} el
   * @returns {{ videoId: string, title: string, channel: string, thumbnail: string, url: string }|null}
   */
  function extractFromElement(el) {
    if (!el) return null;

    // Special case: ytd-reel-item-renderer (Shorts shelf card)
    if (el.tagName.toLowerCase() === 'ytd-reel-item-renderer') {
      return _extractFromReelItem(el);
    }

    // Special case: ytd-reel-video-renderer (Shorts player feed item)
    if (el.tagName.toLowerCase() === 'ytd-reel-video-renderer') {
      return _extractFromReelRenderer(el);
    }

    // Find the anchor link containing the video URL
    const anchor =
      el.querySelector('a#video-title-link') ||
      el.querySelector('a#thumbnail') ||
      el.querySelector('a[href*="/watch?v="]') ||
      el.querySelector('a[href*="/shorts/"]');

    if (!anchor) return null;

    const href = anchor.getAttribute('href') || '';
    const videoId = extractVideoId(href);
    if (!videoId) return null;

    // Title
    const titleEl =
      el.querySelector('#video-title') ||
      el.querySelector('h3 a') ||
      el.querySelector('.title') ||
      el.querySelector('yt-formatted-string#video-title') ||
      el.querySelector('[aria-label]');

    const title = titleEl
      ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim()
      : '';

    // Channel name
    const channelEl =
      el.querySelector('ytd-channel-name yt-formatted-string') ||
      el.querySelector('.ytd-channel-name') ||
      el.querySelector('#channel-name') ||
      el.querySelector('a.yt-simple-endpoint[href*="/@"]') ||
      el.querySelector('a.yt-simple-endpoint[href*="/channel/"]');

    const channel = channelEl ? channelEl.textContent.trim() : '';

    // Thumbnail URL
    const thumbEl =
      el.querySelector('img.yt-core-image') ||
      el.querySelector(' ytd-thumbnail img') ||
      el.querySelector('img#img') ||
      el.querySelector('img');

    const thumbnail =
      thumbEl?.getAttribute('src') ||
      thumbEl?.getAttribute('data-thumb') ||
      '';

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    return { videoId, title, channel, thumbnail, url };
  }

  /**
   * Extract video data from a Shorts player reel (ytd-reel-video-renderer).
   * @param {Element} el
   * @returns {object|null}
   */
  function _extractFromReelRenderer(el) {
    const anchor =
      el.querySelector('a[href*="/shorts/"]') ||
      el.querySelector('a[href*="/watch?v="]') ||
      el.querySelector('a.yt-simple-endpoint[href]');

    let videoId = anchor ? extractVideoId(anchor.getAttribute('href') || '') : null;

    // Active reel may not expose href yet — fall back to URL
    if (!videoId && el.hasAttribute('is-active')) {
      videoId = getCurrentVideoId();
    }

    if (!videoId) return null;

    const titleEl =
      el.querySelector('h2') ||
      el.querySelector('#video-title') ||
      el.querySelector('yt-formatted-string');

    const title = titleEl
      ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim()
      : '';

    const channelEl =
      el.querySelector('ytd-channel-name') ||
      el.querySelector('#channel-name');
    const channel = channelEl ? channelEl.textContent.trim() : '';

    return {
      videoId,
      title,
      channel,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url: `https://www.youtube.com/shorts/${videoId}`,
    };
  }

  function _extractFromReelItem(el) {
    // The main anchor on a reel item wraps the thumbnail
    const anchor =
      el.querySelector('a[href*="/shorts/"]') ||
      el.querySelector('a');

    if (!anchor) return null;

    const href = anchor.getAttribute('href') || '';
    const videoId = extractVideoId(href);
    if (!videoId) return null;

    const titleEl =
      el.querySelector('span#video-title') ||
      el.querySelector('#video-title') ||
      el.querySelector('span[id="video-title"]') ||
      el.querySelector('yt-formatted-string');

    const title = titleEl
      ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim()
      : '';

    const thumbEl =
      el.querySelector('img.yt-core-image') ||
      el.querySelector('img');

    const thumbnail = thumbEl?.getAttribute('src') || '';

    return {
      videoId,
      title,
      channel: '',
      thumbnail,
      url: `https://www.youtube.com/shorts/${videoId}`,
    };
  }

  /**
   * Extract data from the ACTIVE Short in the full-screen player.
   * Returns the videoId currently playing.
   * @returns {{ videoId: string }|null}
   */
  function extractFromShortsPlayer() {
    const videoId = extractVideoId(window.location.href);
    if (!videoId) return null;

    const titleEl =
      document.querySelector('ytd-reel-video-renderer[is-active] h2') ||
      document.querySelector('ytd-reel-video-renderer[is-active] #video-title') ||
      document.querySelector('ytd-shorts h2');

    const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '').trim();

    const channelEl =
      document.querySelector('ytd-reel-video-renderer[is-active] ytd-channel-name') ||
      document.querySelector('ytd-reel-video-renderer[is-active] #channel-name') ||
      document.querySelector('ytd-shorts #channel-name');
    const channel = channelEl ? channelEl.textContent.trim() : '';

    return {
      videoId,
      title,
      channel,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      url: window.location.href,
    };
  }

  // ─── LIKE/DISLIKE DETECTION ──────────────────────────────────────────────────

  /**
   * Detect the current like/dislike state on a video watch page OR Shorts player.
   * Uses aria-pressed and aria-label attributes on the like/dislike buttons.
   * @returns {{ liked: boolean, disliked: boolean }|null}
   */
  function detectLikeDislikeState() {
    // Shorts player has its own like/dislike DOM inside ytd-reel-video-renderer[is-active]
    if (isShortsPlayer()) {
      return _detectShortsLikeState();
    }

    const likeButton = _findLikeButton();
    const dislikeButton = _findDislikeButton();

    if (!likeButton && !dislikeButton) return null;

    return {
      liked: _isButtonActive(likeButton),
      disliked: _isButtonActive(dislikeButton),
    };
  }

  /**
   * Detect like/dislike within the active Shorts reel.
   * The like/dislike actions are inside the active ytd-reel-video-renderer.
   * @returns {{ liked: boolean, disliked: boolean }|null}
   */
  function _detectShortsLikeState() {
    const root = getShortsRoot() || document;

    // YouTube 2024+: shared action bar (buttons are NOT inside each reel)
    let likeBtn =
      root.querySelector('like-button-view-model button[aria-label]') ||
      root.querySelector('ytd-like-button-renderer button[aria-label]');
    let dislikeBtn =
      root.querySelector('dislike-button-view-model button[aria-label]') ||
      root.querySelector('ytd-dislike-button-renderer button[aria-label]');

    // Fallback: visible like/dislike buttons in the Shorts UI
    if (!likeBtn || !dislikeBtn) {
      const visible = _findVisibleShortsButtons(root);
      likeBtn = likeBtn || visible.like;
      dislikeBtn = dislikeBtn || visible.dislike;
    }

    // Last resort: active reel scope
    if (!likeBtn || !dislikeBtn) {
      const reel = getActiveShortsReel();
      if (reel) {
        likeBtn = likeBtn || _findShortsButton(reel, ['like', 'gostei', 'curtir'], ['dislike', 'não gostei', 'não curtir']);
        dislikeBtn = dislikeBtn || _findShortsButton(reel, ['dislike', 'não gostei', 'não curtir'], []);
      }
    }

    if (!likeBtn && !dislikeBtn) return null;

    return {
      liked: _isButtonActive(likeBtn),
      disliked: _isButtonActive(dislikeBtn),
    };
  }

  function _findVisibleShortsButtons(root) {
    let like = null;
    let dislike = null;

    for (const btn of root.querySelectorAll('button[aria-label], yt-button-shape button')) {
      const rect = btn.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;

      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const isDislike =
        label.includes('não gostei') ||
        label.includes('dislike') ||
        label.includes('não curtir');
      const isLike =
        !isDislike &&
        (label.includes('gostei') || label.includes('like') || label.includes('curtir'));

      if (isLike && !like) like = btn;
      if (isDislike && !dislike) dislike = btn;
      if (like && dislike) break;
    }

    return { like, dislike };
  }

  /**
   * Check if a click target is a Shorts like/dislike button.
   * @param {Element} target
   * @returns {'like'|'dislike'|null}
   */
  function getShortsRatingClickType(target) {
    const btn = target.closest('button[aria-label]');
    if (!btn) return null;

    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
    if (
      label.includes('não gostei') ||
      label.includes('dislike') ||
      label.includes('não curtir')
    ) {
      return 'dislike';
    }
    if (
      label.includes('gostei') ||
      label.includes('like') ||
      label.includes('curtir')
    ) {
      return 'like';
    }
    return null;
  }

  /**
   * Find a button within a Shorts scope by aria-label keywords.
   * @param {Element} scope
   * @param {string[]} includeTerms
   * @param {string[]} excludeTerms
   * @returns {Element|null}
   */
  function _findShortsButton(scope, includeTerms, excludeTerms) {
    const buttons = scope.querySelectorAll(
      'button[aria-label], yt-button-shape button, button.yt-spec-button-shape-next'
    );
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const included = includeTerms.some((t) => label.includes(t));
      const excluded = excludeTerms.some((t) => label.includes(t));
      if (included && !excluded) return btn;
    }
    return null;
  }

  function _findLikeButton() {
    const modern =
      document.querySelector('like-button-view-model button[aria-label]') ||
      document.querySelector('ytd-segmented-like-dislike-button-renderer #like-button button');
    if (modern) return modern;

    // YouTube uses aria-label containing "Gostei", "Like", etc.
    const candidates = document.querySelectorAll(
      'button[aria-label], ytd-toggle-button-renderer button, yt-button-shape button'
    );

    for (const btn of candidates) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (
        label.includes('gostei') ||
        label.includes('like') ||
        label.includes('curtir')
      ) {
        // Exclude dislike buttons
        if (
          !label.includes('não gostei') &&
          !label.includes('dislike') &&
          !label.includes('não curtir')
        ) {
          return btn;
        }
      }
    }

    // Fallback: find within like/dislike segmented button
    return (
      document.querySelector('ytd-segmented-like-dislike-button-renderer #like-button button') ||
      document.querySelector('ytd-toggle-button-renderer:first-of-type button') ||
      null
    );
  }

  function _findDislikeButton() {
    const modern =
      document.querySelector('dislike-button-view-model button[aria-label]') ||
      document.querySelector('ytd-segmented-like-dislike-button-renderer #dislike-button button');
    if (modern) return modern;

    const candidates = document.querySelectorAll(
      'button[aria-label], ytd-toggle-button-renderer button, yt-button-shape button'
    );

    for (const btn of candidates) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (
        label.includes('não gostei') ||
        label.includes('dislike') ||
        label.includes('não curtir')
      ) {
        return btn;
      }
    }

    return (
      document.querySelector('ytd-segmented-like-dislike-button-renderer #dislike-button button') ||
      null
    );
  }

  /**
   * Check if a button element is in "active/pressed" state.
   * @param {Element|null} btn
   * @returns {boolean}
   */
  function _isButtonActive(btn) {
    if (!btn) return false;

    // Check aria-pressed attribute
    if (btn.getAttribute('aria-pressed') === 'true') return true;

    // Check for active class on parent toggle renderer
    const toggleRenderer = btn.closest('ytd-toggle-button-renderer');
    if (toggleRenderer) {
      if (toggleRenderer.hasAttribute('is-toggled')) return true;
      if (toggleRenderer.getAttribute('is-toggled') === 'true') return true;
    }

    // Check button itself for pressed/active styles
    if (btn.classList.contains('style-default-active')) return true;

    // Check yt-spec-button-shape-with-price or similar containers
    const parent = btn.closest('[is-toggled]');
    if (parent && parent.getAttribute('is-toggled') !== 'false') {
      return !!parent.getAttribute('is-toggled');
    }

    return false;
  }

  /**
   * Find the thumbnail container within a video card element.
   * Used to position the badge overlay.
   * @param {Element} el
   * @returns {Element|null}
   */
  function getThumbnailContainer(el) {
    // Shorts player reel: overlay / player container
    if (el.tagName.toLowerCase() === 'ytd-reel-video-renderer') {
      return (
        el.querySelector('#player-container') ||
        el.querySelector('.html5-video-player') ||
        el.querySelector('#shorts-player') ||
        el.querySelector('ytd-player') ||
        el
      );
    }

    // Shorts shelf item: the anchor wrapping the thumbnail image
    if (el.tagName.toLowerCase() === 'ytd-reel-item-renderer') {
      return (
        el.querySelector('ytd-thumbnail') ||
        el.querySelector('a[href*="/shorts/"]') ||
        el
      );
    }

    return (
      el.querySelector('ytd-thumbnail') ||
      el.querySelector('a#thumbnail') ||
      el.querySelector('.ytd-thumbnail') ||
      el.querySelector('yt-image') ||
      el
    );
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  return {
    extractVideoId,
    getCurrentVideoId,
    isWatchPage,
    isShortsPage,
    isShortsPlayer,
    isShortsShelf,
    getActiveShortsReel,
    getShortsRoot,
    getCurrentShortsVideoId,
    getShortsRatingClickType,
    VIDEO_ELEMENTS_SELECTOR,
    VIDEO_ELEMENT_TAGS,
    SHORTS_PLAYER_SELECTOR,
    extractFromElement,
    extractFromShortsPlayer,
    detectLikeDislikeState,
    getThumbnailContainer,
  };
})();
