# Monetag Integration Guide for FastConvert

Monetag has been integrated into FastConvert using a central JavaScript ad manager and site-root Service Worker (`sw.js`).

---

## 📁 Key Files Configured

1. **`sw.js` (Site Root Service Worker)**
   - Path: `file:///g:/fastconvert/sw.js`
   - Configured with your Monetag domain (`5gvci.com`) and Zone ID (`11564181`):
     ```javascript
     self.options = {
         "domain": "5gvci.com",
         "zoneId": 11564181
     };
     self.lary = "";
     importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw');
     ```

2. **`js/monetag.js` (Central Ad Manager)**
   - Path: `file:///g:/fastconvert/js/monetag.js`
   - Automatically loaded on **all 15 HTML pages** across FastConvert.
   - Registers `/sw.js` for Web Push notifications on page load.
   - Dynamically loads In-Page Push and Monetag zone tag scripts (`https://5gvci.com/pfe/current/tag.min.js?z=11564181`).

3. **`inject-monetag.js` (Injection Automation)**
   - Path: `file:///g:/fastconvert/inject-monetag.js`
   - Run `node inject-monetag.js` whenever new pages or tool folders are added in the future.

4. **`ads.txt`**
   - Path: `file:///g:/fastconvert/ads.txt`
   - Includes a section for any additional `ads.txt` lines provided by your Monetag dashboard.

---

## ⚙️ How to Add or Change Monetag Ad Formats

If you create additional Monetag zones (such as **Vignette Banner**, **OnClick Popunder**, or **Multi-Tag**), simply edit `js/monetag.js`:

```javascript
const MONETAG_CONFIG = {
  domain: '5gvci.com',
  zoneId: 11564181,

  enableServiceWorkerPush: true, // Web Push Ads (/sw.js)
  enableInPagePush: true,        // In-Page Push Banners
  enableVignetteBanner: false,   // Set to true if active
  enableOnClickPopunder: false,  // Set to true if active
};
```

---

## 🚀 Deployment Checklist

1. Deploy the updated code to your web server / Vercel (`https://fastconvert.tech/`).
2. Ensure `sw.js` is accessible at `https://fastconvert.tech/sw.js`.
3. Open your site in an incognito window or test on mobile to verify push prompt and Monetag ads!
