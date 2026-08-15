/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module (Individual Tags)
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG INDIVIDUAL TAGS CONFIGURATION ---
  const MONETAG_INDIVIDUAL_CONFIG = {
    popunder: { enabled: false, zoneId: '', src: '' },
    inPagePush: { enabled: true, zoneId: '11564395', src: 'https://nap5k.com/tag.min.js' },
    vignetteBanner: { enabled: true, zoneId: '11564295', src: 'https://n6wxm.com/vignette.min.js' },
    directLink: { enabled: false, url: '' },
    webPush: { enabled: true, swPath: '/sw.js' }
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

  // --- TARGETED POPUNDER AD TRIGGERING ---
  // Trigger popunder ads ONLY on Convert/Compress buttons and Download buttons
  const AD_TARGET_SELECTORS = [
    // 1. CONVERT / COMPRESS / PROCESS BUTTONS
    '#convert-btn',
    '#compress-btn',
    '.btn-convert',
    '#pdf-action-btn',
    '.btn-pdf-action',

    // 2. DOWNLOAD BUTTONS
    '#download-btn',
    '.btn-download',
    '.download-btn',
    '.download-all-btn',
    '.pdf-result-downloads a',
    '.pdf-result-downloads button',
    '[download]'
  ].join(', ');

  // Elements where popunder ads MUST NEVER trigger (File dropzones, file selectors, header, menu, nav, tool cards)
  const NO_AD_EXCLUDE_SELECTORS = [
    // 1. FILE SELECTION & DROPZONES (ALL TOOLS & HOMEPAGE)
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
    '.tool-card',
    '.tools-grid',
    '.hero-cta',
    '.remove-file',
    '.size-pill',
    '.split-pill',

    // 2. HEADER, MENU & NAVIGATION
    '.site-header',
    'header',
    'nav',
    '.nav-menu',
    '.header-nav',
    '.header-nav-link',
    '.dropdown-menu',
    '.dropdown-toggle',
    '.mobile-menu-toggle',
    '.theme-toggle'
  ].join(', ');

  const AD_EVENT_TYPES = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown'];

  // Wrap addEventListener on window/document/body to filter ad click and touch events
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (AD_EVENT_TYPES.includes(type) && (this === window || this === document || this === document.body)) {
      const filteredListener = function (event) {
        if (!event || !event.target || !event.target.closest) {
          return listener.call(this, event);
        }

        // 1. Explicitly block popunder ads when selecting files, browsing dropzones, or navigating menus/tool cards
        if (event.target.closest(NO_AD_EXCLUDE_SELECTORS)) {
          return;
        }

        // 2. MUST be an explicit Convert/Compress or Download button
        const isTargetAction = event.target.closest(AD_TARGET_SELECTORS);
        if (!isTargetAction) {
          return; // Block popunder for all other clicks
        }

        // 3. Trigger popunder ad ONLY for Convert and Download actions
        listener.call(this, event);
      };
      return origAddEventListener.call(this, type, filteredListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  // Also proxy document.onclick / window.onclick if set by Monetag
  let _docOnClick = null;
  try {
    Object.defineProperty(document, 'onclick', {
      get: function () { return _docOnClick; },
      set: function (fn) {
        if (!fn) { _docOnClick = null; return; }
        _docOnClick = function (event) {
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
  } catch (e) {
    // Ignore if property redefinition is restricted by browser
  }

  // 1. Register Service Worker for Web Push Ads
  if (MONETAG_INDIVIDUAL_CONFIG.webPush.enabled && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(MONETAG_INDIVIDUAL_CONFIG.webPush.swPath, { scope: '/' })
        .then(function (registration) {
          console.log('[Monetag] ServiceWorker registered with scope:', registration.scope);
        })
        .catch(function (error) {
          console.warn('[Monetag] ServiceWorker registration failed:', error);
        });
    });
  }

  // 2. Helper to load individual Monetag scripts dynamically
  function loadIndividualTag(tagConfig, name) {
    if (tagConfig && tagConfig.enabled && tagConfig.src) {
      if (!document.querySelector(`script[src="${tagConfig.src}"]`)) {
        const s = document.createElement('script');
        s.src = tagConfig.src;
        s.async = true;
        if (tagConfig.zoneId) s.setAttribute('data-zone', tagConfig.zoneId);
        s.setAttribute('data-cfasync', 'false');
        (document.head || document.documentElement).appendChild(s);
        console.log(`[Monetag] Loaded individual tag: ${name}`);
      }
    }
  }

  // Load active individual ad tags
  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.popunder, 'Popunder');
  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.inPagePush, 'In-Page Push');
  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.vignetteBanner, 'Vignette Banner');

  window.Monetag = {
    config: MONETAG_INDIVIDUAL_CONFIG,
    loadTag: loadIndividualTag
  };

})();
