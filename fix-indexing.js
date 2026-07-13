// Script to fix indexing issues on all tool pages
// Run with: node fix-indexing.js

const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, 'tools');

// Tool metadata for BreadcrumbList schema
const toolMeta = {
  'image-converter': { name: 'Image Converter', category: 'Image Tools', categoryAnchor: '#image-tools-section' },
  'image-compressor': { name: 'Image Compressor', category: 'Image Tools', categoryAnchor: '#image-tools-section' },
  'resize-image': { name: 'Resize Image', category: 'Image Tools', categoryAnchor: '#image-tools-section' },
  'crop-image': { name: 'Crop Image', category: 'Image Tools', categoryAnchor: '#image-tools-section' },
  'pdf-merge': { name: 'Merge PDFs', category: 'PDF Tools', categoryAnchor: '#pdf-tools-section' },
  'pdf-split': { name: 'Split PDF', category: 'PDF Tools', categoryAnchor: '#pdf-tools-section' },
  'pdf-compress': { name: 'Compress PDF', category: 'PDF Tools', categoryAnchor: '#pdf-tools-section' },
  'image-to-pdf': { name: 'Images to PDF', category: 'PDF Tools', categoryAnchor: '#pdf-tools-section' },
  'rotate-pdf': { name: 'Rotate PDF', category: 'PDF Tools', categoryAnchor: '#pdf-tools-section' },
};

function getBreadcrumbSchema(toolSlug) {
  const meta = toolMeta[toolSlug];
  if (!meta) return '';
  return `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://fastconvert.tech/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "${meta.category}",
        "item": "https://fastconvert.tech/${meta.categoryAnchor}"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "${meta.name}",
        "item": "https://fastconvert.tech/tools/${toolSlug}/"
      }
    ]
  }
  </script>`;
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
  if (!meta) { console.log(`Skip ${toolSlug} - no metadata`); continue; }
  
  let changes = [];

  // 1. Fix relative CSS path to absolute
  if (html.includes('href="../../styles.css"')) {
    html = html.replace('href="../../styles.css"', 'href="/styles.css"');
    changes.push('CSS path');
  }
  
  // 2. Fix relative JS paths to absolute
  if (html.includes('src="../../js/shared.js"')) {
    html = html.replace('src="../../js/shared.js"', 'src="/js/shared.js"');
    changes.push('shared.js path');
  }
  if (html.includes('src="../../js/pdf-tools.js"')) {
    html = html.replace('src="../../js/pdf-tools.js"', 'src="/js/pdf-tools.js"');
    changes.push('pdf-tools.js path');
  }
  
  // 3. Add BreadcrumbList schema if not present
  if (!html.includes('BreadcrumbList')) {
    const breadcrumbSchema = getBreadcrumbSchema(toolSlug);
    html = html.replace('</head>', breadcrumbSchema + '\n</head>');
    changes.push('BreadcrumbList schema');
  }
  
  // 4. Fix breadcrumb navigation links
  if (html.includes('<a href="/">PDF Tools</a>')) {
    html = html.replace('<a href="/">PDF Tools</a>', '<a href="/#pdf-tools-section">PDF Tools</a>');
    changes.push('breadcrumb PDF link');
  }
  if (html.includes('<a href="/">Image Tools</a>')) {
    html = html.replace('<a href="/">Image Tools</a>', '<a href="/#image-tools-section">Image Tools</a>');
    changes.push('breadcrumb Image link');
  }
  
  if (changes.length > 0) {
    fs.writeFileSync(indexPath, html, 'utf-8');
    console.log(`Done: ${toolSlug} [${changes.join(', ')}]`);
    updated++;
  } else {
    console.log(`No changes needed: ${toolSlug}`);
  }
}

console.log(`\nUpdated ${updated} tool pages.`);
