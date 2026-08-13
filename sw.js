// Monetag Service Worker Configuration
self.options = {
    "domain": "3nbf4.com",
    "zoneId": 11564244
};

// Import Monetag service worker functionality
try {
    importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw');
} catch (error) {
    console.error('[Monetag SW] Failed to import external service worker:', error);
}

// Fallback: Handle push notifications if external import fails
self.addEventListener('push', function(event) {
    console.log('[Monetag SW] Push notification received');
});
