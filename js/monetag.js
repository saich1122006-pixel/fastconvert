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

  // --- ALLOWED AD ACTION BUTTON SELECTORS ---
  // Popunder ads trigger ONLY when clicking Convert/Compress or Download action buttons
  const AD_TARGET_SELECTORS = [
    // 1. Convert / Compress / Process buttons
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

    // 2. Download buttons
    '#download-btn',
    '.btn-download',
    '.download-btn',
    '.download-all-btn',
    '.pdf-result-downloads a',
    '.pdf-result-downloads button',
    '[download]',
    'a[download]'
  ].join(', ');

  // Track timestamp of legitimate Convert/Download action clicks
  let lastAllowedAdActionTime = 0;

  window.addEventListener('click', function (e) {
    if (e && e.target && e.target.closest && e.target.closest(AD_TARGET_SELECTORS)) {
      lastAllowedAdActionTime = Date.now();
    }
  }, true);

  // --- POPUNDER AD CONTROL: PROXY window.open ---
  // Block window.open popunder requests unless the user clicked an explicit Convert or Download button.
  // This leaves all site event listeners completely untouched so all website buttons work natively.
  const origWindowOpen = window.open;

  window.open = function (url, name, specs) {
    const now = Date.now();
    const isRecentAdAction = (now - lastAllowedAdActionTime) < 2000;
    const currentEvt = window.event;
    const target = (currentEvt && currentEvt.target) || document.activeElement;

    const isAllowedTarget = Boolean(target && target.closest && target.closest(AD_TARGET_SELECTORS));

    if (!isRecentAdAction && !isAllowedTarget) {
      console.log('[Monetag] Popunder window.open blocked on non-ad element click:', target);
      return null; // Block popunder ad window silently
    }

    return origWindowOpen.call(window, url, name, specs);
  };

  // --- 1. Register Service Worker for Web Push Ads ---
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

  // --- 2. Load Monetag Multitag Script ---
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
