/**
 * YouTube Check — DOM Observer
 * Wraps MutationObserver with debouncing for efficient DOM change detection.
 */

const YTDomObserver = (() => {

  let _observer = null;
  let _debounceTimer = null;
  let _pendingNodes = [];
  const DEBOUNCE_MS = 200;

  /**
   * Start observing the YouTube SPA root for DOM mutations.
   * Calls `onNewElements` with an array of newly inserted relevant elements.
   *
   * @param {function(Element[]): void} onNewElements
   * @param {string} selector - CSS selector for relevant elements
   */
  function start(onNewElements, selector) {
    if (_observer) {
      stop();
    }

    const root = document.body || document.documentElement;
    if (!root) return;

    _observer = new MutationObserver((mutations) => {
      const newNodes = [];

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;

        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if this node itself matches
          if (node.matches && node.matches(selector)) {
            newNodes.push(node);
          }

          // Check children within this node
          const children = node.querySelectorAll ? node.querySelectorAll(selector) : [];
          for (const child of children) {
            newNodes.push(child);
          }
        }
      }

      if (newNodes.length > 0) {
        _pendingNodes.push(...newNodes);
        _scheduledFlush(onNewElements);
      }
    });

    _observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Debounced flush — batches DOM updates to avoid thrashing.
   * @param {function(Element[]): void} callback
   */
  function _scheduledFlush(callback) {
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
    }
    _debounceTimer = setTimeout(() => {
      const batch = _pendingNodes.splice(0);
      if (batch.length > 0) {
        callback(batch);
      }
    }, DEBOUNCE_MS);
  }

  /**
   * Stop the observer and clean up.
   */
  function stop() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    if (_debounceTimer) {
      clearTimeout(_debounceTimer);
      _debounceTimer = null;
    }
    _pendingNodes = [];
  }

  /**
   * Watch for YouTube SPA page navigation (url changes).
   * YouTube is a SPA and uses history.pushState, so we need to detect navigation.
   *
   * @param {function(string): void} onNavigate - called with the new URL
   */
  function watchNavigation(onNavigate) {
    // Listen for YouTube's custom yt-navigate-finish event
    document.addEventListener('yt-navigate-finish', () => {
      onNavigate(window.location.href);
    });

    // Fallback: also listen for popstate
    window.addEventListener('popstate', () => {
      onNavigate(window.location.href);
    });

    // Patch history.pushState for SPAs that don't fire events
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(() => onNavigate(window.location.href), 100);
    };

    // Patch history.replaceState (used by YouTube when scrolling through Shorts)
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(() => onNavigate(window.location.href), 100);
    };
  }

  /**
   * Observe attribute changes on a specific element (for like/dislike toggle).
   * @param {Element} el
   * @param {string[]} attributes
   * @param {function(): void} callback
   * @returns {MutationObserver}
   */
  function observeAttributes(el, attributes, callback) {
    const attrObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (attributes.includes(mutation.attributeName)) {
          callback();
          break;
        }
      }
    });

    attrObserver.observe(el, {
      attributes: true,
      attributeFilter: attributes,
      subtree: true,
    });

    return attrObserver;
  }

  /**
   * Call `callback` once `selector` matches an element in the DOM.
   * Useful after hard reloads when YouTube mounts its UI asynchronously.
   *
   * @param {string} selector
   * @param {function(Element): void} callback
   * @param {{ root?: Element, timeout?: number }} [options]
   */
  function whenReady(selector, callback, options = {}) {
    const { root = document.documentElement, timeout = 30000 } = options;
    const existing = document.querySelector(selector);
    if (existing) {
      callback(existing);
      return;
    }

    let timer = null;
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      observer.disconnect();
      if (timer) clearTimeout(timer);
      callback(el);
    });

    observer.observe(root, { childList: true, subtree: true });

    if (timeout > 0) {
      timer = setTimeout(() => observer.disconnect(), timeout);
    }
  }

  return {
    start,
    stop,
    watchNavigation,
    observeAttributes,
    whenReady,
  };
})();
