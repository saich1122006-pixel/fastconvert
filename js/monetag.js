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
