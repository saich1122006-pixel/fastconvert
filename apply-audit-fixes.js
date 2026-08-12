const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;

const socialHTML = `
        <div class="footer-social-section">
          <div class="footer-social-title">Follow &amp; Connect</div>
          <div class="footer-social-links">
            <a href="https://github.com/fastconvert" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="GitHub">
              <svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            </a>
            <a href="https://twitter.com/fastconvert_tech" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="Twitter">
              <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://linkedin.com/company/fastconvert" target="_blank" rel="noopener noreferrer" class="social-icon-btn" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
            </a>
          </div>
        </div>`;

const cookieBannerHTML = `
  <!-- Cookie Consent Banner -->
  <div id="cookie-banner" class="cookie-banner hidden" role="region" aria-label="Cookie Consent Banner">
    <div class="cookie-banner-content">
      <span class="cookie-banner-icon" role="img" aria-label="Cookie">🍪</span>
      <p class="cookie-banner-text">
        We use essential cookies &amp; local storage to power fast online conversion. No personal data is stored or uploaded. Learn more in our <a href="/privacy/">Privacy Policy</a>.
      </p>
    </div>
    <div class="cookie-banner-actions">
      <button id="cookie-decline-btn" class="btn-cookie-decline" type="button">Decline</button>
      <button id="cookie-accept-btn" class="btn-cookie-accept" type="button">Accept &amp; Continue</button>
    </div>
  </div>
  <script>
    (function() {
      try {
        var banner = document.getElementById('cookie-banner');
        if (!banner) return;
        var consent = localStorage.getItem('fc_cookie_consent');
        if (!consent) {
          banner.classList.remove('hidden');
        }
        var acceptBtn = document.getElementById('cookie-accept-btn');
        var declineBtn = document.getElementById('cookie-decline-btn');
        if (acceptBtn) {
          acceptBtn.addEventListener('click', function() {
            localStorage.setItem('fc_cookie_consent', 'accepted');
            banner.classList.add('hidden');
          });
        }
        if (declineBtn) {
          declineBtn.addEventListener('click', function() {
            localStorage.setItem('fc_cookie_consent', 'declined');
            banner.classList.add('hidden');
          });
        }
      } catch(e){}
    })();
  </script>`;

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(getAllHtmlFiles(filePath));
      }
    } else if (file.endsWith('.html')) {
      results.push(filePath);
    }
  });
  return results;
}

const htmlFiles = getAllHtmlFiles(ROOT_DIR);

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // 1. Add Cookie Banner if missing
  if (!content.includes('id="cookie-banner"')) {
    content = content.replace('</body>', cookieBannerHTML + '\n</body>');
    modified = true;
  }

  // 2. Add Social Links inside footer-brand if missing
  if (!content.includes('footer-social-links') && content.includes('<div class="footer-brand">')) {
    content = content.replace(/(<div class="footer-brand">[\s\S]*?<p>[\s\S]*?<\/p>)/, `$1\n${socialHTML}`);
    modified = true;
  }

  // 3. Replace logo SVG with logo img in footer or header if missing img
  if (!content.includes('brand-logo-img') && content.includes('<div class="logo">')) {
    content = content.replace(
      /<div class="logo">\s*<svg[\s\S]*?<\/svg>\s*<span/g,
      '<div class="logo">\n          <img src="/favicon.svg" alt="FastConvert Logo" class="brand-logo-img" width="28" height="28" />\n          <span'
    );
    modified = true;
  }

  if (modified) {
    fs.readFileSync(file, 'utf8'); // check read
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
