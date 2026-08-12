// Script to add enhancements to all tool pages
// Run with: node enhance-tool-pages.js

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, 'tools');

// Tool metadata for cross-linking, structured data, breadcrumbs
const toolMeta = {
  'image-converter': {
    name: 'Image Converter',
    category: 'Image Tools',
    icon: '🔄',
    desc: 'Convert between PNG, JPG, WebP, and HEIC formats instantly.',
    related: ['image-compressor', 'resize-image', 'crop-image']
  },
  'image-compressor': {
    name: 'Image Compressor',
    category: 'Image Tools',
    icon: '📐',
    desc: 'Compress images to exact file sizes like 20KB or 50KB.',
    related: ['image-converter', 'resize-image', 'crop-image']
  },
  'resize-image': {
    name: 'Resize Image',
    category: 'Image Tools',
    icon: '📏',
    desc: 'Change image dimensions to exact pixel values.',
    related: ['crop-image', 'image-compressor', 'image-converter']
  },
  'crop-image': {
    name: 'Crop Image',
    category: 'Image Tools',
    icon: '✂️',
    desc: 'Crop images to remove unwanted areas easily.',
    related: ['resize-image', 'image-compressor', 'image-converter']
  },
  'pdf-merge': {
    name: 'Merge PDFs',
    category: 'PDF Tools',
    icon: '🔗',
    desc: 'Combine multiple PDF files into one document.',
    related: ['pdf-split', 'pdf-compress', 'image-to-pdf']
  },
  'pdf-split': {
    name: 'Split PDF',
    category: 'PDF Tools',
    icon: '✂️',
    desc: 'Extract specific pages from a PDF document.',
    related: ['pdf-merge', 'pdf-compress', 'rotate-pdf']
  },
  'pdf-compress': {
    name: 'Compress PDF',
    category: 'PDF Tools',
    icon: '📐',
    desc: 'Reduce PDF file size while preserving quality.',
    related: ['pdf-merge', 'pdf-split', 'image-to-pdf']
  },
  'image-to-pdf': {
    name: 'Images to PDF',
    category: 'PDF Tools',
    icon: '🖼️',
    desc: 'Convert JPG, PNG, or WebP images into a PDF.',
    related: ['pdf-merge', 'pdf-compress', 'image-converter']
  },
  'rotate-pdf': {
    name: 'Rotate PDF',
    category: 'PDF Tools',
    icon: '↻',
    desc: 'Rotate pages in your PDF document easily.',
    related: ['pdf-split', 'pdf-merge', 'pdf-compress']
  }
};

// Full footer HTML
const fullFooter = `
  <footer class="site-footer" role="contentinfo">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="logo">
          <img src="/favicon.svg" alt="FastConvert Logo" class="brand-logo-img" width="28" height="28" />
          <span style="color: #f1f5f9; font-weight: 800; font-size: 1.4rem; letter-spacing: -0.02em;"><span style="color: #4f46e5;">Fast</span>Convert</span>
        </div>
        <p>Free, fast, and private image &amp; PDF tools — powered entirely by your browser.</p>
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
        </div>
      </div>
      <nav class="footer-nav" aria-label="Footer navigation">
        <div class="footer-nav-col">
          <h4>Pages</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about/">About Us</a></li>
            <li><a href="/privacy/">Privacy Policy</a></li>
            <li><a href="/terms/">Terms of Service</a></li>
            <li><a href="/contact/">Contact Us</a></li>
            <li><a href="/disclaimer/">Disclaimer</a></li>
          </ul>
        </div>
        <div class="footer-nav-col">
          <h4>Image Tools</h4>
          <ul>
            <li><a href="/tools/image-converter/">Image Converter</a></li>
            <li><a href="/tools/image-compressor/">Image Compressor</a></li>
            <li><a href="/tools/resize-image/">Resize Image</a></li>
            <li><a href="/tools/crop-image/">Crop Image</a></li>
          </ul>
        </div>
        <div class="footer-nav-col">
          <h4>PDF Tools</h4>
          <ul>
            <li><a href="/tools/pdf-merge/">Merge PDFs</a></li>
            <li><a href="/tools/pdf-split/">Split PDF</a></li>
            <li><a href="/tools/pdf-compress/">Compress PDF</a></li>
            <li><a href="/tools/image-to-pdf/">Images to PDF</a></li>
            <li><a href="/tools/rotate-pdf/">Rotate PDF</a></li>
          </ul>
        </div>
      </nav>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 FastConvert. All rights reserved. Built with ❤️ for the open web.</p>
    </div>
  </footer>`;

// Cookie Banner Snippet
const cookieBannerSnippet = `
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

// Google Analytics snippet
const gaSnippet = `
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z21HFSG8NK"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-Z21HFSG8NK');
  </script>`;

function getRelatedToolsHTML(toolSlug) {
  const meta = toolMeta[toolSlug];
  if (!meta) return '';
  
  let cards = '';
  for (const relSlug of meta.related) {
    const rel = toolMeta[relSlug];
    if (rel) {
      cards += `
        <a href="/tools/${relSlug}/" class="related-tool-card">
          <span class="related-icon" aria-hidden="true">${rel.icon}</span>
          <h3>${rel.name}</h3>
          <p>${rel.desc}</p>
        </a>`;
    }
  }
  
  return `
      <!-- Related Tools -->
      <div class="related-tools-section">
        <h2>You Might Also Need</h2>
        <div class="related-tools-grid">${cards}
        </div>
      </div>`;
}

function getBreadcrumbsHTML(toolSlug) {
  const meta = toolMeta[toolSlug];
  if (!meta) return '';
  
  return `
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span class="breadcrumb-sep">›</span>
        <a href="/">${meta.category}</a>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">${meta.name}</span>
      </nav>`;
}

function getStructuredDataJSON(toolSlug) {
  const meta = toolMeta[toolSlug];
  if (!meta) return '';
  
  return `
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${meta.name} — FastConvert",
    "url": "https://fastconvert.tech/tools/${toolSlug}/",
    "description": "${meta.desc}",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "FastConvert",
      "url": "https://fastconvert.tech"
    }
  }
  </script>`;
}

// Update nav links
function updateNavLinks(html) {
  // Update About link
  html = html.replace(/<a class="header-nav-link" href="\/#page-about">About<\/a>/g,
    '<a class="header-nav-link" href="/about/">About</a>');
  html = html.replace(/<a class="header-nav-link" href="\/#page-privacy">Privacy<\/a>/g,
    '<a class="header-nav-link" href="/privacy/">Privacy</a>');
  html = html.replace(/<a class="header-nav-link" href="\/#page-contact">Contact<\/a>/g,
    '<a class="header-nav-link" href="/contact/">Contact</a>');
  return html;
}

// Process each tool directory
const toolDirs = fs.readdirSync(TOOLS_DIR).filter(f => 
  fs.statSync(path.join(TOOLS_DIR, f)).isDirectory()
);

let updated = 0;

for (const toolSlug of toolDirs) {
  const indexPath = path.join(TOOLS_DIR, toolSlug, 'index.html');
  if (!fs.existsSync(indexPath)) continue;
  
  let html = fs.readFileSync(indexPath, 'utf-8');
  const meta = toolMeta[toolSlug];
  if (!meta) { console.log(`Skipping ${toolSlug} - no metadata`); continue; }
  
  // 1. Add Google Analytics if not present
  if (!html.includes('googletagmanager.com/gtag')) {
    html = html.replace('</head>', gaSnippet + '\n</head>');
  }
  
  // 2. Add Structured Data if not present
  if (!html.includes('application/ld+json')) {
    html = html.replace('</head>', getStructuredDataJSON(toolSlug) + '\n</head>');
  }
  
  // 3. Add breadcrumbs after <main> opening
  if (!html.includes('breadcrumbs')) {
    const mainContentMatch = html.match(/<div class="content-center">/);
    if (mainContentMatch) {
      html = html.replace('<div class="content-center">',
        '<div class="content-center">' + getBreadcrumbsHTML(toolSlug));
    }
  }
  
  // 4. Replace footer with full footer
  const fullFooterRegex = /<footer class="site-footer" role="contentinfo">[\s\S]*?<\/footer>/s;
  if (fullFooterRegex.test(html)) {
    html = html.replace(fullFooterRegex, fullFooter);
  } else {
    const minFooterRegex = /<footer class="site-footer"[^>]*>\s*<div class="footer-bottom">\s*<p>[^<]*<\/p>\s*<\/div>\s*<\/footer>/s;
    if (minFooterRegex.test(html)) {
      html = html.replace(minFooterRegex, fullFooter);
    }
  }

  // 4b. Add Cookie Banner before </body>
  if (!html.includes('id="cookie-banner"')) {
    html = html.replace('</body>', cookieBannerSnippet + '\n</body>');
  }

  // 5. Add Related Tools section before closing </div> of tool-seo-content
  if (!html.includes('related-tools-section') && html.includes('tool-seo-content')) {
    const relatedHTML = getRelatedToolsHTML(toolSlug);
    // Insert before the closing </div> of tool-seo-content
    html = html.replace(/(<!-- SEO Content[\s\S]*?)<\/div>\s*<\/div>\s*<\/main>/s, (match) => {
      // Find the last </div> before </main> in the SEO section
      const lastDivMainIdx = match.lastIndexOf('</div>\n    </div>\n  </main>');
      if (lastDivMainIdx !== -1) {
        return match.substring(0, lastDivMainIdx) + relatedHTML + '\n\n' + match.substring(lastDivMainIdx);
      }
      return match;
    });
    
    // Fallback: insert before </main>
    if (!html.includes('related-tools-section')) {
      html = html.replace('</main>', relatedHTML + '\n\n  </main>');
    }
  }
  
  // If no tool-seo-content section, add related tools before </main>
  if (!html.includes('related-tools-section')) {
    const relatedHTML = getRelatedToolsHTML(toolSlug);
    html = html.replace('  </main>', '    ' + relatedHTML + '\n\n  </main>');
  }
  
  // 6. Update nav links
  html = updateNavLinks(html);
  
  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log(`✅ Updated: ${toolSlug}`);
  updated++;
}

console.log(`\nDone! Updated ${updated} tool pages.`);

