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
  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.inPagePush, 'In-Page Push');
  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.vignetteBanner, 'Vignette Banner');

  window.Monetag = {
    config: MONETAG_INDIVIDUAL_CONFIG,
    loadTag: loadIndividualTag
  };

})();

