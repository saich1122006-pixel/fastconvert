// Script to inject Adcash JS loader across all HTML files in FastConvert
// Run with: node inject-adcash.js

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const ADCASH_SCRIPT_TAG = `  <!-- Adcash Ad Manager -->
  <script id="aclib" type="text/javascript" src="//acscdn.com/script/aclib.js"></script>
  <script type="text/javascript">
    aclib.runAutoTag({
      zoneId: '4svxb85ixg',
    });
  </script>`;

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

  // Check if Adcash script is already present
  if (content.includes('4svxb85ixg') || content.includes('aclib.js')) {
    console.log(`[SKIPPED] ${path.relative(ROOT_DIR, filePath)} (Adcash script already present)`);
    return false;
  }

  // Find insertion point inside <head>
  if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n${ADCASH_SCRIPT_TAG}`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[UPDATED] ${path.relative(ROOT_DIR, filePath)}`);
    return true;
  } else {
    console.warn(`[WARNING] No <head> tag found in ${path.relative(ROOT_DIR, filePath)}`);
    return false;
  }
}

function run() {
  console.log('--- Starting Adcash Script Injection ---');
  const htmlFiles = getHtmlFiles(ROOT_DIR);
  let updatedCount = 0;

  htmlFiles.forEach(file => {
    if (processHtmlFile(file)) {
      updatedCount++;
    }
  });

  console.log(`\nCompleted! Processed ${htmlFiles.length} HTML files (${updatedCount} updated).`);
}

run();
