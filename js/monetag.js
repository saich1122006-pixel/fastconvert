/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG CONFIGURATION ---
  const MONETAG_CONFIG = {
    // Primary Domain & Zone ID configured for FastConvert
    domain: '5gvci.com',
    zoneId: 11564181,

    // Enable/Disable specific ad features
    enableServiceWorkerPush: true, // Registers /sw.js for Push Notifications
    enableInPagePush: true,        // In-Page Push / Banner ads
    enableVignetteBanner: false,   // Interstitial Vignette ads (Set true when zone tag added)
    enableOnClickPopunder: false,  // OnClick / Popunder ads (Set true when zone tag added)

    // Optional Site Verification Tag (Paste verification code string if provided by Monetag)
    verificationMeta: '' 
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

    // Helper to load In-Page Push / Multi-tag for default zone
    initDefaultZone: function () {
      if (MONETAG_CONFIG.zoneId && MONETAG_CONFIG.domain) {
        const tagUrl = 'https://' + MONETAG_CONFIG.domain + '/pfe/current/tag.min.js?z=' + MONETAG_CONFIG.zoneId;
        this.loadTag(tagUrl);
      }
    }
  };

  // Auto-initialize zone tag if enabled
  if (MONETAG_CONFIG.enableInPagePush) {
    window.Monetag.initDefaultZone();
  }

})();
