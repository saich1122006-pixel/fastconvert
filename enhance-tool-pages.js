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
          <svg class="logo-icon-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#logo-grad-f)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
            <defs><linearGradient id="logo-grad-f" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4f46e5" /><stop offset="100%" stop-color="#0ea5e9" /></linearGradient></defs>
            <polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>
          </svg>
          <span style="color: #f1f5f9; font-weight: 800; font-size: 1.4rem; letter-spacing: -0.02em;"><span style="color: #4f46e5;">Fast</span>Convert</span>
        </div>
        <p>Free, fast, and private image &amp; PDF tools — powered entirely by your browser.</p>
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
  
  // 4. Replace minimal footer with full footer
  const minFooterRegex = /<footer class="site-footer"[^>]*>\s*<div class="footer-bottom">\s*<p>[^<]*<\/p>\s*<\/div>\s*<\/footer>/s;
  if (minFooterRegex.test(html)) {
    html = html.replace(minFooterRegex, fullFooter);
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
