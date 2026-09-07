const fs = require('fs');
const path = require('path');

function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (filePath.endsWith('.html') && filePath !== path.join(__dirname, 'index.html')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const htmlFiles = findHtmlFiles(__dirname);

const oldSnippetRegex = /<div class="header-actions">[\s\S]*?<button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark\/light mode">🌙<\/button>[\s\S]*?<button class="mobile-menu-toggle"/;

const newSnippet = `<div class="header-actions">
      <!-- Header Search -->
      <div class="header-search" id="header-search">
        <button class="header-search-btn" id="header-search-btn" aria-label="Search tools" aria-expanded="false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <div class="header-search-bar" id="header-search-bar">
          <input type="search" id="header-search-input" class="header-search-input"
            placeholder="Search tools…" aria-label="Search tools" autocomplete="off" />
          <button class="header-search-close" id="header-search-close" aria-label="Close search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <button class="mobile-menu-toggle"`;

let updatedCount = 0;
for (const file of htmlFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (oldSnippetRegex.test(content)) {
    content = content.replace(oldSnippetRegex, newSnippet);
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated: ${file}`);
    updatedCount++;
  }
}

console.log(`Done. Updated ${updatedCount} files.`);
