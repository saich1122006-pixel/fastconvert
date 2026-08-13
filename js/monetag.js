/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG CONFIGURATION ---
  const MONETAG_CONFIG = {
    // Primary Domain & Default Zone ID configured for FastConvert
    domain: '3nbf4.com',
    zoneId: 11564244,

    // Specific Monetag Zone IDs & Scripts
    zones: {
      inPagePush: { zoneId: '11564395', src: 'https://nap5k.com/tag.min.js' },
      vignette: { zoneId: '11564295', src: 'https://n6wxm.com/vignette.min.js' },
      popunder: { zoneId: '11564242', src: 'https://quge5.com/88/tag.min.js' }
    },

    // Enable/Disable specific ad features (All active)
    enableServiceWorkerPush: true, // Registers /sw.js for Web Push Notifications
    enableInPagePush: true,        // In-Page Push Banners (Top right float banners)
    enableVignetteBanner: true,    // Interstitial Vignette ads (Fullscreen overlays on interaction)
    enableOnClickPopunder: true,   // OnClick / Popunder ads (Opens on user click)
  };

  // 1. Service Worker Registration (Web Push Ads)
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

  // 2. Dynamic Monetag Script Tag Inserter Helper
  window.Monetag = {
    config: MONETAG_CONFIG,

    // Helper to dynamically load any Monetag Ad Tag Script
    loadTag: function (src, attributes) {
      if (!src) return;
      // Avoid duplicate injection if script tag already exists in DOM
      if (document.querySelector(`script[src="${src}"]`)) return;

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-cfasync', 'false');
      if (attributes && typeof attributes === 'object') {
        Object.keys(attributes).forEach(function (key) {
          s.setAttribute(key, attributes[key]);
        });
      }
      (document.head || document.documentElement).appendChild(s);
    },

    // Initialize all active Monetag ad formats
    initAllZones: function () {
      if (MONETAG_CONFIG.enableInPagePush && MONETAG_CONFIG.zones.inPagePush) {
        this.loadTag(MONETAG_CONFIG.zones.inPagePush.src, { 'data-zone': MONETAG_CONFIG.zones.inPagePush.zoneId });
      }
      if (MONETAG_CONFIG.enableVignetteBanner && MONETAG_CONFIG.zones.vignette) {
        this.loadTag(MONETAG_CONFIG.zones.vignette.src, { 'data-zone': MONETAG_CONFIG.zones.vignette.zoneId });
      }
      if (MONETAG_CONFIG.enableOnClickPopunder && MONETAG_CONFIG.zones.popunder) {
        this.loadTag(MONETAG_CONFIG.zones.popunder.src, { 'data-zone': MONETAG_CONFIG.zones.popunder.zoneId });
      }
      if (MONETAG_CONFIG.zoneId && MONETAG_CONFIG.domain) {
        const defaultTagUrl = 'https://' + MONETAG_CONFIG.domain + '/pfe/current/tag.min.js?z=' + MONETAG_CONFIG.zoneId;
        this.loadTag(defaultTagUrl);
      }
    }
  };

  // Auto-initialize all Monetag ad zones
  window.Monetag.initAllZones();

})();
