/* ====================================================================
   FastConvert — Monetag Central Ad Manager Module (Individual Tags)
   ==================================================================== */

(function () {
  'use strict';

  // --- MONETAG INDIVIDUAL TAGS CONFIGURATION ---
  const MONETAG_INDIVIDUAL_CONFIG = {
    popunder: { enabled: true, zoneId: '11577808', src: 'https://al5sm.com/tag.min.js' },
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



  // --- BLOCK POPUNDER ON PROTECTED ELEMENTS ---
  // Instead of proxying addEventListener (which breaks desktop popunders by
  // disrupting the trusted user-gesture chain), we stop event propagation on
  // protected elements so clicks on them never reach Monetag's global handlers.
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

  function blockAdsOnProtectedElements() {
    const protectedEls = document.querySelectorAll(NO_AD_EXCLUDE_SELECTORS);
    protectedEls.forEach(function (el) {
      if (el.dataset.adBlocked) return; // already handled
      el.dataset.adBlocked = 'true';
      el.addEventListener('click', function (e) { e.stopPropagation(); }, true);
      el.addEventListener('mousedown', function (e) { e.stopPropagation(); }, true);
      el.addEventListener('pointerdown', function (e) { e.stopPropagation(); }, true);
    });
  }

  // Run on load and observe for dynamically added elements
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blockAdsOnProtectedElements);
  } else {
    blockAdsOnProtectedElements();
  }

  // Re-run when DOM changes (new elements added dynamically)
  const observer = new MutationObserver(blockAdsOnProtectedElements);
  observer.observe(document.documentElement, { childList: true, subtree: true });

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

  // In-Page Push ads cover too much screen on mobile — only load on desktop
  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.inPagePush, 'In-Page Push');
  } else {
    console.log('[Monetag] In-Page Push skipped on mobile (screen too small).');
  }

  loadIndividualTag(MONETAG_INDIVIDUAL_CONFIG.vignetteBanner, 'Vignette Banner');

  window.Monetag = {
    config: MONETAG_INDIVIDUAL_CONFIG,
    loadTag: loadIndividualTag
  };

})();

