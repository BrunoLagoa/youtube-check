/**
 * YouTube Check — i18n module
 * Supports user-selected locale (settings) or browser default (auto).
 */

const YTCheckI18n = (() => {
  const SUPPORTED = ['en', 'pt-BR'];
  let currentLocale = 'en';

  /**
   * Resolve effective locale from settings value.
   * @param {string} [localeSetting] - 'auto' | 'en' | 'pt-BR'
   * @returns {string}
   */
  function resolveLocale(localeSetting) {
    if (localeSetting === 'en' || localeSetting === 'pt-BR') {
      return localeSetting;
    }

    let browserLang = 'en';
    try {
      browserLang = chrome?.i18n?.getUILanguage?.() || navigator.language || 'en';
    } catch {
      browserLang = navigator.language || 'en';
    }

    return browserLang.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  }

  /**
   * @param {string} locale
   * @returns {boolean}
   */
  function isSupported(locale) {
    return SUPPORTED.includes(locale);
  }

  /**
   * Set active locale for t().
   * @param {string} locale
   */
  function setLocale(locale) {
    currentLocale = isSupported(locale) ? locale : 'en';
  }

  /**
   * @returns {string}
   */
  function getLocale() {
    return currentLocale;
  }

  /**
   * @returns {string}
   */
  function getDateLocale() {
    return currentLocale === 'pt-BR' ? 'pt-BR' : 'en-US';
  }

  /**
   * Translate a message key.
   * @param {string} key
   * @param {string|number} [sub1]
   * @param {string} [localeOverride]
   * @returns {string}
   */
  function t(key, sub1, localeOverride) {
    const locale = localeOverride && isSupported(localeOverride) ? localeOverride : currentLocale;
    const catalog = YTCheckMessages[locale] || YTCheckMessages.en;
    let message = catalog[key] ?? YTCheckMessages.en[key] ?? key;

    if (sub1 !== undefined && sub1 !== null) {
      message = message.replace('$1', String(sub1));
    }

    return message;
  }

  /**
   * Default badge text for a locale.
   * @param {string} [locale]
   * @returns {string}
   */
  function getDefaultBadgeText(locale) {
    const loc = locale && isSupported(locale) ? locale : currentLocale;
    return t('badgeTextDefault', undefined, loc);
  }

  /**
   * @param {string} text
   * @returns {boolean}
   */
  function isDefaultBadgeText(text) {
    if (!text) return true;
    return YTCheckLegacyBadgeDefaults.includes(text) ||
      SUPPORTED.some((loc) => text === getDefaultBadgeText(loc));
  }

  /**
   * Initialize i18n from settings and apply to document.
   * @param {object} [settings]
   * @param {Element} [root]
   */
  function init(settings, root = document) {
    setLocale(resolveLocale(settings?.locale));
    document.documentElement.lang = currentLocale;
    applyDOM(root);
  }

  /**
   * Apply data-i18n* attributes within root.
   * @param {Element} [root]
   */
  function applyDOM(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.dataset.i18nTitle);
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });

    root.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.alt = t(el.dataset.i18nAlt);
    });

    if (root === document && document.title && document.querySelector('meta[data-i18n-title]')) {
      // optional: page title from meta
    }

    const titleKey = root.querySelector?.('[data-page-title]')?.dataset?.pageTitle;
    if (titleKey && root === document) {
      document.title = t(titleKey);
    }
  }

  /**
   * Format relative/absolute date using current locale.
   * @param {number} ts
   * @returns {string}
   */
  function formatDate(ts) {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);

    if (min < 1) return t('dateNow');
    if (min < 60) return `${min}min`;
    if (hr < 24) return `${hr}h`;
    if (day < 7) return `${day}d`;
    return new Date(ts).toLocaleDateString(getDateLocale(), { day: '2-digit', month: '2-digit' });
  }

  return {
    SUPPORTED,
    resolveLocale,
    setLocale,
    getLocale,
    getDateLocale,
    t,
    getDefaultBadgeText,
    isDefaultBadgeText,
    init,
    applyDOM,
    formatDate,
  };
})();
