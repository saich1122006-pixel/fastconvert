/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module (Multitag)
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG MULTITAG CONFIGURATION ---
  const MONETAG_CONFIG = {
    zoneId: '269642',
    src: 'https://quge5.com/88/tag.min.js',
    enableServiceWorkerPush: true
  };

  // --- DEV & NO-ADS BYPASS CHECK ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('noads') === '1' || urlParams.get('dev') === '1') {
    localStorage.setItem('fastconvert_no_ads', 'true');
    console.log('[Monetag] Developer mode enabled: Ads disabled on this device.');
  } else if (urlParams.get('noads') === '0' || urlParams.get('dev') === '0') {
    localStorage.removeItem('fastconvert_no_ads');
    console.log('[Monetag] Developer mode disabled: Ads enabled.');
  }

  const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^192\.168\.\d+\.\d+$/) ||
    window.location.hostname.match(/^10\.\d+\.\d+\.\d+$/) ||
    window.location.hostname.endsWith('.local')
  );

  const isNoAdsEnabled = localStorage.getItem('fastconvert_no_ads') === 'true';

  if (isLocalhost || isNoAdsEnabled) {
    console.log('[Monetag] Ads skipped (Localhost or ?noads=1 active)');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[Monetag] Unregistered existing service worker for dev mode.');
        }
      });
    }
    return;
  }

  // --- STRICT TARGETED AD ACTION ALLOWLIST ---
  // Popunder ads MUST ONLY trigger when user explicitly clicks a Convert/Compress or Download action button
  const AD_TARGET_SELECTORS = [
    // 1. CONVERT / COMPRESS / PROCESS BUTTONS (HOMEPAGE & TOOL PAGES)
    '#convert-btn',
    '#compress-btn',
    '.btn-convert',
    '#pdf-action-btn',
    '.btn-pdf-action',
    '#smart-convert-btn',
    '#smart-compress-img-btn',
    '#smart-pdf-compress',
    '#smart-pdf-split',
    '#smart-pdf-merge',
    '#smart-img-to-pdf',
    '#crop-btn',
    '#resize-btn',
    '#rotate-btn',

    // 2. DOWNLOAD BUTTONS (HOMEPAGE & TOOL PAGES)
    '#download-btn',
    '.btn-download',
    '.download-btn',
    '.download-all-btn',
    '.pdf-result-downloads a',
    '.pdf-result-downloads button',
    '[download]',
    'a[download]'
  ].join(', ');

  // Elements where popunder ads MUST NEVER trigger (Dropzones, File pickers, Search box, Header, Nav, Cards, Controls)
  const NO_AD_EXCLUDE_SELECTORS = [
    // 1. HOMEPAGE SMART DROPZONE & FILE SELECTION
    '#smart-dropzone',
    '.smart-dropzone-styled',
    '#smart-dropzone-default',
    '.smart-dropzone-default',
    '.smart-dropzone-icon-bg',
    '.smart-dropzone-btn',
    '#smart-file-input',
    '#smart-dropzone-info',
    '#smart-file-list',
    '#smart-add-more-files',
    '#smart-clear-files',
    '#smart-actions-area',
    '#smart-actions-title',
    '#smart-actions-image',
    '#smart-actions-pdf',
    '#smart-actions-mixed',
    '.add-more-files',
    '.remove-file',
    '.size-pill',
    '.split-pill',

    // 2. TOOL PAGES DROPZONES & FILE INPUTS
    '.dropzone-wrapper',
    '#dropzone',
    '.pdf-dropzone',
    '#pdf-dropzone',
    '#dropzone-default',
    '#dropzone-file-info',
    '.dropzone-icon',
    '.dropzone-text',
    '.dropzone-hint',
    'input[type="file"]',
    '#file-input',
    '#pdf-file-input',
    '#image-file-input',
    '.select-files-btn',
    '.btn-select-files',
    '.upload-area',
    '.upload-box',

    // 3. SEARCH TOOL & INPUTS
    '.site-search-wrapper',
    '.site-search-box',
    '.site-search-input',
    '#tool-search-input',
    'input[type="search"]',
    '#search-clear-btn',
    '.site-search-clear-btn',
    '#no-search-results',
    '#no-results-reset-btn',
    '.site-search-icon',

    // 4. CONTROLS, FORM SELECTORS, SLIDERS & OPTIONS
    'select',
    'input',
    'textarea',
    'option',
    '#smart-format-select',
    '#smart-quality-slider',
    '.format-selector',
    '.quality-control',
    '.size-presets',
    'label',

    // 5. NAVIGATION, HEADER, FOOTER & TOOL CARDS
    '.site-header',
    'header',
    'nav',
    'footer',
    '.nav-menu',
    '.header-nav',
    '.header-nav-link',
    '.dropdown-menu',
    '.dropdown-toggle',
    '.mobile-menu-toggle',
    '.theme-toggle',
    '.conversion-card',
    '.pdf-tool-card',
    '.category-tab',
    '.category-tabs',
    '#dynamic-category-title',
    '#image-tools-section',
    '#pdf-tools-section'
  ].join(', ');

  const AD_EVENT_TYPES = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'focus', 'focusin', 'input', 'keydown'];

  // Track timestamp of legitimate Convert/Download action clicks
  let lastAllowedAdActionTime = 0;

  window.addEventListener('click', function (e) {
    if (e && e.target && e.target.closest && e.target.closest(AD_TARGET_SELECTORS)) {
      lastAllowedAdActionTime = Date.now();
    }
  }, true);

  // --- HARD POPUNDER SHIELD: PROXY window.open ---
  // Monetag popunders open via window.open. Block window.open unless user clicked an explicit Convert/Download button.
  const origWindowOpen = window.open;
  window.open = function (...args) {
    const now = Date.now();
    const isRecentAdAction = (now - lastAllowedAdActionTime) < 1500;
    const currentEvt = window.event;
    const target = (currentEvt && currentEvt.target) || document.activeElement;

    const isExcluded = target && target.closest && target.closest(NO_AD_EXCLUDE_SELECTORS);
    const isAllowedTarget = target && target.closest && target.closest(AD_TARGET_SELECTORS);

    if (isExcluded || (!isRecentAdAction && !isAllowedTarget)) {
      console.log('[Monetag] POPUNDER BLOCKED on non-ad element:', target);
      return null; // Block popunder window!
    }

    return origWindowOpen.apply(this, args);
  };

  // --- EVENT LISTENER SHIELD: INTERCEPT addEventListener ---
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (AD_EVENT_TYPES.includes(type)) {
      const filteredListener = function (event) {
        if (!event || !event.target || !event.target.closest) {
          return listener.call(this, event);
        }

        // 1. BLOCK popunder ad triggers on dropzones, file selection, search, header, nav, tool cards, sliders, selects
        if (event.target.closest(NO_AD_EXCLUDE_SELECTORS) || (event.target.tagName && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName.toUpperCase()))) {
          return;
        }

        // 2. MUST be an explicit Convert/Compress or Download button
        const isTargetAction = event.target.closest(AD_TARGET_SELECTORS);
        if (!isTargetAction) {
          return; // Block popunder for all non-action clicks
        }

        // 3. Trigger popunder ad ONLY for Convert and Download actions
        listener.call(this, event);
      };
      return origAddEventListener.call(this, type, filteredListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  // Block popunder ad event propagation on search inputs and file dropzones site-wide
  document.addEventListener('DOMContentLoaded', function () {
    const protectedElements = document.querySelectorAll(NO_AD_EXCLUDE_SELECTORS);
    protectedElements.forEach(function (el) {
      ['click', 'mousedown', 'touchstart', 'focus'].forEach(function (evtType) {
        el.addEventListener(evtType, function (e) {
          if (!e.target.closest(AD_TARGET_SELECTORS)) {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
              e.stopPropagation();
            }
          }
        }, true);
      });
    });
  });

  // Proxy document.onclick / window.onclick if set by Monetag
  ['onclick', 'onmousedown', 'ontouchstart'].forEach(function (prop) {
    let _val = null;
    try {
      Object.defineProperty(document, prop, {
        get: function () { return _val; },
        set: function (fn) {
          if (!fn) { _val = null; return; }
          _val = function (event) {
            if (event && event.target && event.target.closest) {
              if (event.target.closest(NO_AD_EXCLUDE_SELECTORS)) return;
              if (event.target.closest(AD_TARGET_SELECTORS)) {
                fn.call(this, event);
              }
            }
          };
        },
        configurable: true
      });
    } catch (e) { }
  });

  // 1. Register Service Worker for Web Push Ads
  if (MONETAG_CONFIG.enableServiceWorkerPush && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (registration) {
          console.log('[Monetag] ServiceWorker registered with scope:', registration.scope);
        })
        .catch(function (error) {
          console.warn('[Monetag] ServiceWorker registration failed:', error);
        });
    });
  }

  // 2. Load Monetag Multitag Script
  window.Monetag = {
    config: MONETAG_CONFIG,
    init: function () {
      if (!document.querySelector(`script[src="${MONETAG_CONFIG.src}"]`)) {
        const s = document.createElement('script');
        s.src = MONETAG_CONFIG.src;
        s.async = true;
        s.setAttribute('data-zone', MONETAG_CONFIG.zoneId);
        s.setAttribute('data-cfasync', 'false');
        (document.head || document.documentElement).appendChild(s);
      }
    }
  };

  window.Monetag.init();

})();
