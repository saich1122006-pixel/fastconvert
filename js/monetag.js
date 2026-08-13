/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module (Multitag)
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG MULTITAG CONFIGURATION ---
  const MONETAG_CONFIG = {
    domain: '3nbf4.com',
    zoneId: 11564244,
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

  // 2. Load Monetag Multitag Script (Handles In-Page Push, Vignette, Popunder, & Push)
  window.Monetag = {
    config: MONETAG_CONFIG,
    init: function () {
      if (MONETAG_CONFIG.zoneId && MONETAG_CONFIG.domain) {
        const tagUrl = 'https://' + MONETAG_CONFIG.domain + '/pfe/current/tag.min.js?z=' + MONETAG_CONFIG.zoneId;
        if (!document.querySelector(`script[src="${tagUrl}"]`)) {
          const s = document.createElement('script');
          s.src = tagUrl;
          s.async = true;
          s.setAttribute('data-cfasync', 'false');
          (document.head || document.documentElement).appendChild(s);
        }
      }
    }
  };

  window.Monetag.init();

})();
