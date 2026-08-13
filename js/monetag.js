/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module
   ==================================================================== */

(function () {
  'use strict';

  // --- DEV & NO-ADS BYPASS CHECK ---
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('noads') === '1' || urlParams.get('dev') === '1') {
    localStorage.setItem('fastconvert_no_ads', 'true');
    console.log('[Monetag] Developer mode enabled: Ads disabled on this device.');
  } else if (urlParams.get('noads') === '0' || urlParams.get('dev') === '0') {
    localStorage.removeItem('fastconvert_no_ads');
    console.log('[Monetag] Developer mode disabled.');
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
        }
      });
    }
    return;
  }

  // --- HARD POPUNDER SHIELD: COMPLETELY DISABLE POPUNDERS ---
  // Block any window.open attempt originating from ad networks
  const origWindowOpen = window.open;
  window.open = function (url, name, specs) {
    if (url && (url.includes('quge5.com') || url.includes('popunder') || url.includes('onclick'))) {
      console.log('[Monetag] Blocked popunder window:', url);
      return null; // Block popunder window completely
    }
    return origWindowOpen.call(window, url, name, specs);
  };

  // --- 1. Service Worker Registration (Web Push Notifications if needed) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }

  // --- 2. Monetag Global API Stub (Popunders Disabled) ---
  window.Monetag = {
    config: { enableServiceWorkerPush: true },
    init: function () {
      console.log('[Monetag] Popunder ads are completely removed from FastConvert.');
    }
  };

  window.Monetag.init();

})();
