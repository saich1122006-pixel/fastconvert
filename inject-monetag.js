// Script to inject Monetag JS loader across all HTML files in FastConvert
// Run with: node inject-monetag.js

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const MONETAG_SCRIPT_TAG = '  <!-- Monetag Ad Manager -->\n  <script src="/js/monetag.js" defer></script>';

function getHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === '.git' || file === 'node_modules') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function processHtmlFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if Monetag script is already present
  if (content.includes('monetag.js')) {
    console.log(`[SKIPPED] ${path.relative(ROOT_DIR, filePath)} (Monetag script already present)`);
    return false;
  }

  // Find insertion point before </head>
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${MONETAG_SCRIPT_TAG}\n</head>`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[UPDATED] ${path.relative(ROOT_DIR, filePath)}`);
    return true;
  } else {
    console.warn(`[WARNING] No </head> tag found in ${path.relative(ROOT_DIR, filePath)}`);
    return false;
  }
}

function run() {
  console.log('--- Starting Monetag Script Injection ---');
  const htmlFiles = getHtmlFiles(ROOT_DIR);
  let updatedCount = 0;

  htmlFiles.forEach(file => {
    if (processHtmlFile(file)) {
      updatedCount++;
    }
  });

  console.log(`\nCompleted! Injected Monetag script into ${updatedCount} / ${htmlFiles.length} HTML files.`);
}

run();
