// Script to remove ALL Monetag / ad-network code from every HTML file
// Run with: node remove-ads.js

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;

// Patterns to strip (order matters: strip lines first, then empty-line cleanup)
const LINE_PATTERNS = [
  // Inline push/pop tag (one-liner)
  /^\s*<script>\(function\(s\)\{s\.dataset\.zone=.+nap5k\.com\/tag\.min\.js.+<\/script>\s*$/,
  /^\s*<script>\(function \(s\) \{.+nap5k\.com\/tag\.min\.js.+<\/script>\s*$/,
  // Monetag comment
  /^\s*<!--\s*Monetag Ad Manager\s*-->\s*$/,
  // monetag.js script tag
  /^\s*<script\s[^>]*\/js\/monetag\.js[^>]*><\/script>\s*$/,
  // Any other nap5k / monetag loader
  /^\s*<script\s[^>]*nap5k\.com[^>]*>.*<\/script>\s*$/,
];

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

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split(/\r?\n/);
  let changed = false;

  const filtered = lines.filter(line => {
    for (const pat of LINE_PATTERNS) {
      if (pat.test(line)) {
        changed = true;
        return false; // remove this line
      }
    }
    return true;
  });

  if (changed) {
    // Preserve original line endings (CRLF vs LF)
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(filePath, filtered.join(eol), 'utf8');
    console.log(`[CLEANED] ${path.relative(ROOT_DIR, filePath)}`);
  } else {
    console.log(`[SKIPPED] ${path.relative(ROOT_DIR, filePath)} (nothing to remove)`);
  }
}

function run() {
  console.log('--- Removing all ad tags from HTML files ---');
  const htmlFiles = getHtmlFiles(ROOT_DIR);
  htmlFiles.forEach(processFile);
  console.log(`\nDone. Processed ${htmlFiles.length} HTML file(s).`);
}

run();
