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
    'ytd-compact-video-renderer',      // Compact sidebar (watch page, legacy layout)
    'yt-lockup-view-model',            // Watch page sidebar "up next" (current layout)
    'ytd-grid-video-renderer',         // Channel / Playlist grid
    'ytd-playlist-video-renderer',     // Playlist list view (legacy; /playlist now ships lockups)
    'ytd-playlist-panel-video-renderer', // Playlist panel on the watch page, autoplay queue & Mix
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

  /**
   * The playlist queue rendered beside the player on `/watch?list=...`.
   * Kept separate from the generic card selector so the page counter can scope
   * itself to the playlist instead of mixing it with the recommendations.
   */
  const PLAYLIST_PANEL_SELECTOR = 'ytd-playlist-panel-video-renderer';

  /**
   * The playlist queue items on the current page, if any.
   * @returns {NodeListOf<Element>}
   */
  function getPlaylistPanelItems() {
    return document.querySelectorAll(PLAYLIST_PANEL_SELECTOR);
  }

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

  /**
   * The reel currently on screen.
   *
   * `is-active` is gone from the current Shorts DOM, so it is only the first of
   * three layers — matching the URL's video ID and, failing that, the reel
   * overlapping the viewport centre are what actually resolve today.
   * @returns {Element|null}
   */
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
   * Positioning parent for the Shorts "already rated" pill.
   *
   * The reel itself is the anchor of choice: it is `position: relative` and its
   * box is exactly the video area, which is what the absolute placement in
   * `.ytcheck-shorts-player-indicator` expects. The overlay renderer is wider
   * (it includes the action-bar column), so it only serves as a fallback —
   * as do the legacy `#overlay` / `.metadata-container` nodes, both of which
   * YouTube has since dropped from the reel.
   *
   * @returns {Element|null}
   */
  function getShortsIndicatorAnchor() {
    const reel = getActiveShortsReel();
    if (reel) {
      return (
        reel.querySelector('#overlay') ||
        reel.querySelector('.metadata-container') ||
        reel
      );
    }

    return (
      document.querySelector('ytd-reel-player-overlay-renderer') ||
      document.querySelector('yt-reel-player-overlay-view-model') ||
      null
    );
  }

  /**
   * Current Short video ID — URL is the source of truth in the player.
   * @returns {string|null}
   */
  function getCurrentShortsVideoId() {
    return getCurrentVideoId();
  }

  /**
   * Returns the actual <video> element currently playing — the regular watch
   * page player, or the active Short's player when in the Shorts feed.
   * Used for watch-progress-based "viewed" detection.
   * @returns {HTMLVideoElement|null}
   */
  function getActiveVideoElement() {
    if (isShortsPlayer()) {
      const reel = getActiveShortsReel();
      return reel ? reel.querySelector('video') : null;
    }
    return document.querySelector('#movie_player video, video.html5-main-video');
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

    // Title — current lockup layout first (YouTube renamed the BEM classes to
    // PascalCase: .yt-lockup-metadata-view-model__title → .ytLockupMetadataViewModelTitle),
    // then the legacy ytd-* renderers.
    const titleEl =
      el.querySelector('a.ytLockupMetadataViewModelTitle') ||
      el.querySelector('#video-title') ||
      el.querySelector('h3 a') ||
      el.querySelector('.title') ||
      el.querySelector('yt-formatted-string#video-title') ||
      el.querySelector('a.yt-lockup-metadata-view-model__title') ||
      el.querySelector('.yt-lockup-metadata-view-model__title') ||
      el.querySelector('[role="text"]') ||
      el.querySelector('[aria-label]');

    const title = titleEl
      ? (titleEl.getAttribute('title') ||
         titleEl.getAttribute('aria-label') ||
         titleEl.textContent ||
         '').trim()
      : '';

    const channel = _extractChannelName(el);

    // Thumbnail URL
    const thumbEl =
      el.querySelector('img.ytCoreImageHost') ||
      el.querySelector('img.yt-core-image') ||
      el.querySelector(' ytd-thumbnail img') ||
      el.querySelector('img#img') ||
      el.querySelector('img');

    // Lockup cards lazy-load the <img>, so src is often empty on first pass —
    // fall back to the canonical thumbnail derived from the video ID.
    const thumbnail =
      thumbEl?.getAttribute('src') ||
      thumbEl?.getAttribute('data-thumb') ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const url = `https://www.youtube.com/watch?v=${videoId}`;

    return { videoId, title, channel, thumbnail, url };
  }

  /**
   * Channel name from a video card.
   *
   * The lockup layout dropped `ytd-channel-name`; its channel now sits in a
   * `yt-content-metadata-view-model` row that also carries view count and age,
   * so that node's text is unusable. The channel link is the reliable handle —
   * but the avatar is a link too, hence the "must have text" filter.
   *
   * @param {Element} el
   * @returns {string}
   */
  function _extractChannelName(el) {
    const legacy =
      el.querySelector('ytd-channel-name yt-formatted-string') ||
      el.querySelector('.ytd-channel-name') ||
      el.querySelector('#channel-name');
    if (legacy) {
      const text = legacy.textContent.trim();
      if (text) return text;
    }

    for (const link of el.querySelectorAll('a[href^="/@"], a[href^="/channel/"], a.yt-simple-endpoint[href*="/@"]')) {
      const text = link.textContent.trim();
      if (text) return text;
    }

    // Playlist panel items expose no channel link at all — their `#byline` is
    // the channel name on its own (unlike the other renderers, where the same
    // id also carries view count and age).
    if (el.matches?.(PLAYLIST_PANEL_SELECTOR)) {
      const byline = el.querySelector('#byline');
      if (byline) return byline.textContent.trim();
    }

    return '';
  }

  /**
   * Extract video data from a Shorts player reel (ytd-reel-video-renderer).
   * @param {Element} el
   * @returns {object|null}
   */
  function _extractVideoIdFromMedia(el) {
    for (const img of el.querySelectorAll('img[src*="/vi/"]')) {
      const id = extractVideoId(img.getAttribute('src') || '');
      if (id) return id;
    }
    for (const video of el.querySelectorAll('video[poster*="/vi/"]')) {
      const id = extractVideoId(video.getAttribute('poster') || '');
      if (id) return id;
    }
    return null;
  }

  function _extractFromReelRenderer(el) {
    const anchor =
      el.querySelector('a[href*="/shorts/"]') ||
      el.querySelector('a[href*="/watch?v="]') ||
      el.querySelector('a.yt-simple-endpoint[href]');

    let videoId = anchor ? extractVideoId(anchor.getAttribute('href') || '') : null;

    if (!videoId) {
      videoId = _extractVideoIdFromMedia(el);
    }

    // The reel on screen may not expose an href yet — fall back to the URL.
    // `is-active` is gone from the current DOM, where the feed holds a single
    // reel node, so that case stands in for it. (Deliberately not calling
    // getActiveShortsReel here — it calls back into this function.)
    const isTheOnlyReel = document.querySelectorAll('ytd-reel-video-renderer').length === 1;
    if (!videoId && isShortsPlayer() && (el.hasAttribute('is-active') || isTheOnlyReel)) {
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
      el.querySelector('img.ytCoreImageHost') ||
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

    // Scoped to the reel on screen — `[is-active]` no longer exists.
    const reel = getActiveShortsReel();
    const titleEl = reel
      ? (reel.querySelector('h2') ||
         reel.querySelector('#video-title') ||
         reel.querySelector('yt-shorts-video-title-view-model'))
      : document.querySelector('ytd-shorts h2');

    const title = titleEl ? titleEl.textContent.trim() : document.title.replace(' - YouTube', '').trim();

    const channelEl = reel
      ? (reel.querySelector('ytd-channel-name') ||
         reel.querySelector('#channel-name') ||
         reel.querySelector('yt-reel-channel-bar-view-model') ||
         reel.querySelector('a[href^="/@"]'))
      : document.querySelector('ytd-shorts #channel-name');
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
   *
   * Returns `null` — never a `{liked:false, disliked:false}` guess — while no
   * trustworthy button is mounted yet. Callers persist whatever comes back, so a
   * guess here would record the video as unrated and wipe an existing mark.
   *
   * `dislikeReadable` is false on layouts that expose no dislike control at all
   * (the current Shorts player), so callers can leave the stored value alone.
   *
   * @returns {{ liked: boolean, disliked: boolean, dislikeReadable: boolean }|null}
   */
  function detectLikeDislikeState() {
    // Shorts player has its own like/dislike DOM inside the reel's action bar
    if (isShortsPlayer()) {
      return _detectShortsLikeState();
    }

    const likeButton = _findLikeButton();
    if (!likeButton) return null;

    const dislikeButton = _findDislikeButton();

    return {
      liked: _isButtonActive(likeButton),
      disliked: _isButtonActive(dislikeButton),
      dislikeReadable: !!dislikeButton,
    };
  }

  /**
   * Detect like/dislike for the Short currently playing. The action bar was
   * lifted out of the reel body (`extract-action-bar`) into the player overlay,
   * but both still live inside the reel element.
   * @returns {{ liked: boolean, disliked: boolean, dislikeReadable: boolean }|null}
   */
  function _detectShortsLikeState() {
    const scope = getActiveShortsReel() || getShortsRoot() || document;

    const likeBtn = _findRatingButton('like', scope) || _findRatingButton('like');
    if (!likeBtn) return null;

    // The current Shorts layout ships no dislike button at all — report that
    // rather than letting a missing button read as "not disliked".
    const dislikeBtn = _findRatingButton('dislike', scope) || _findRatingButton('dislike');

    return {
      liked: _isButtonActive(likeBtn),
      disliked: _isButtonActive(dislikeBtn),
      dislikeReadable: !!dislikeBtn,
    };
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
   * Components that render their own like/dislike pair which must never be read
   * as the video's rating. Today that's the AI summary card, whose buttons rate
   * the summary, not the video — and whose aria-label still says "Gostei".
   */
  const RATING_DECOY_SELECTOR = 'video-summary-content-view-model';

  /**
   * A rating button is only trustworthy once it is actually laid out.
   *
   * YouTube renders the like/dislike pair several times over: the watch action
   * bar, the player's quick-action overlay (`yt-player-quick-action-buttons`,
   * sized 0×0 until fullscreen) and yt-smartimation's off-screen animation
   * buffers. The hidden copies keep their initial `aria-pressed="false"`, so
   * reading one of them reports a liked video as unrated. Requiring a non-zero
   * box picks whichever copy is really on screen — including the quick-action
   * one in fullscreen, where it *is* the control the user clicks.
   *
   * @param {Element|null} btn
   * @returns {boolean}
   */
  function _isUsableRatingButton(btn) {
    if (!btn || btn.closest(RATING_DECOY_SELECTOR)) return false;
    const rect = btn.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Layered selectors per rating kind: the real watch action bar first, then any
   * view-model instance, then the legacy Polymer renderers.
   */
  const RATING_SELECTORS = {
    like: [
      '#top-level-buttons-computed like-button-view-model button[aria-label]',
      'ytd-watch-metadata like-button-view-model button[aria-label]',
      'segmented-like-dislike-button-view-model like-button-view-model button[aria-label]',
      'like-button-view-model button[aria-label]',
      'ytd-segmented-like-dislike-button-renderer #like-button button',
    ],
    dislike: [
      '#top-level-buttons-computed dislike-button-view-model button[aria-label]',
      'ytd-watch-metadata dislike-button-view-model button[aria-label]',
      'segmented-like-dislike-button-view-model dislike-button-view-model button[aria-label]',
      'dislike-button-view-model button[aria-label]',
      'ytd-segmented-like-dislike-button-renderer #dislike-button button',
    ],
  };

  /** aria-label keywords (pt-BR + en) for the last-resort layer. */
  const RATING_KEYWORDS = {
    like: {
      include: ['gostei', 'like', 'curtir'],
      exclude: ['não gostei', 'nao gostei', 'dislike', 'não curtir', 'nao curtir', 'resumo', 'summary'],
    },
    dislike: {
      include: ['não gostei', 'nao gostei', 'dislike', 'não curtir', 'nao curtir'],
      exclude: ['resumo', 'summary'],
    },
  };

  /**
   * Find the on-screen like or dislike button.
   * @param {'like'|'dislike'} kind
   * @param {Element|Document} [scope]
   * @returns {Element|null}
   */
  function _findRatingButton(kind, scope = document) {
    for (const selector of RATING_SELECTORS[kind]) {
      for (const btn of scope.querySelectorAll(selector)) {
        if (_isUsableRatingButton(btn)) return btn;
      }
    }

    // Last layer: match by aria-label, for layouts we haven't seen yet.
    const { include, exclude } = RATING_KEYWORDS[kind];
    const candidates = scope.querySelectorAll(
      'button[aria-label], ytd-toggle-button-renderer button, yt-button-shape button'
    );

    for (const btn of candidates) {
      if (!_isUsableRatingButton(btn)) continue;
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (include.some((t) => label.includes(t)) && !exclude.some((t) => label.includes(t))) {
        return btn;
      }
    }

    return null;
  }

  function _findLikeButton() {
    return _findRatingButton('like');
  }

  function _findDislikeButton() {
    return _findRatingButton('dislike');
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
      el.querySelector('yt-thumbnail-view-model') ||             // current lockup layout
      el.querySelector('.ytLockupViewModelContentImage') ||      // current lockup naming
      el.querySelector('.yt-lockup-view-model-wiz__content-image') || // previous lockup naming
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
    getShortsIndicatorAnchor,
    getCurrentShortsVideoId,
    getActiveVideoElement,
    getShortsRatingClickType,
    VIDEO_ELEMENTS_SELECTOR,
    VIDEO_ELEMENT_TAGS,
    SHORTS_PLAYER_SELECTOR,
    PLAYLIST_PANEL_SELECTOR,
    getPlaylistPanelItems,
    extractFromElement,
    extractFromShortsPlayer,
    detectLikeDislikeState,
    getThumbnailContainer,
  };
})();
