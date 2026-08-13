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

  // --- STRICT TARGETED POPUNDER AD TRIGGERING ---
  // Popunder ads MUST trigger ONLY when clicking Convert/Compress action buttons or Download buttons.
  // ALL other clicks (mobile menu bar, dropzones, file selection, search input, header navigation) are strictly blocked.
  const AD_TARGET_SELECTORS = [
    // 1. CONVERT / COMPRESS / PROCESS ACTION BUTTONS
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
    '#process-btn',
    '.btn-process',

    // 2. DOWNLOAD BUTTONS
    '#download-btn',
    '.btn-download',
    '.download-btn',
    '.download-all-btn',
    '.pdf-result-downloads a',
    '.pdf-result-downloads button',
    '#smart-result-downloads a',
    '#smart-result-downloads button',
    'a[download]',
    'button[download]'
  ].join(', ');

  const AD_EVENT_TYPES = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup'];

  // Intercept addEventListener site-wide to filter Monetag event listeners
  const origAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (AD_EVENT_TYPES.includes(type)) {
      const filteredListener = function (event) {
        if (!event) return;

        let target = event.target;
        if (target && target.nodeType === 3) target = target.parentNode; // Handle text nodes
        if (!target || !target.closest) return;

        // Strict Check: Match target against allowed AD_TARGET_SELECTORS
        const isTargetAction = target.closest(AD_TARGET_SELECTORS);
        if (!isTargetAction) {
          // NOT a Convert or Download action -> STRICTLY BLOCK POPUNDER AD
          return;
        }

        return listener.call(this, event);
      };

      return origAddEventListener.call(this, type, filteredListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  // Intercept onevent properties (onclick, ontouchstart, etc.) on document, window, and body
  const EVENT_PROPS = ['onclick', 'ontouchstart', 'onpointerdown', 'onmouseup', 'ontouchend', 'onpointerup'];

  function createEventPropProxy(targetObj, propName) {
    let _store = null;
    try {
      Object.defineProperty(targetObj, propName, {
        get: function () { return _store; },
        set: function (fn) {
          if (typeof fn !== 'function') {
            _store = null;
            return;
          }
          _store = function (event) {
            if (!event) return;
            let target = event.target;
            if (target && target.nodeType === 3) target = target.parentNode;
            if (!target || !target.closest) return;

            if (target.closest(AD_TARGET_SELECTORS)) {
              return fn.call(this, event);
            }
          };
        },
        configurable: true
      });
    } catch (e) { }
  }

  EVENT_PROPS.forEach(function (prop) {
    createEventPropProxy(document, prop);
    createEventPropProxy(window, prop);
    if (document.body) createEventPropProxy(document.body, prop);
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
