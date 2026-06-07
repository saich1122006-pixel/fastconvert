/* ============================================
   FastConvert — Client-Side Application Logic
   v2: HEIC support, Compress-to-Size, Conversion Cards
   ============================================ */

(function () {
  'use strict';

  // --- State ---
  let currentFile = null;      // Original file (or HEIC-converted blob)
  let originalFileSize = 0;    // Track original size for compression stats
  let convertedBlob = null;
  let convertedFileName = '';
  let currentMode = 'convert'; // 'convert' | 'compress'
  let targetCompressSize = 51200; // default 50KB

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Elements
  const themeToggleBtn     = $('#theme-toggle');
  const fileInput          = $('#file-input');
  const dropzone           = $('#dropzone');
  const dropzoneDefault    = $('#dropzone-default');
  const dropzoneFileInfo   = $('#dropzone-file-info');
  const fileName           = $('#file-name');
  const fileSize           = $('#file-size');
  const removeFileBtn      = $('#remove-file');
  const imagePreview       = $('#image-preview');
  const previewImg         = $('#preview-img');
  const formatSelect       = $('#format-select');
  const qualityControl     = $('#quality-control');
  const qualitySlider      = $('#quality-slider');
  const qualityValue       = $('#quality-value');
  const convertBtn         = $('#convert-btn');
  const compressBtn        = $('#compress-btn');
  const convertControls    = $('#convert-controls');
  const compressControls   = $('#compress-controls');
  const resultArea         = $('#result-area');
  const resultTitle        = $('#result-title');
  const resultFormat       = $('#result-format');
  const resultSize         = $('#result-size');
  const resultStats        = $('#result-stats');
  const statOriginal       = $('#stat-original');
  const statCompressed     = $('#stat-compressed');
  const statSavings        = $('#stat-savings');
  const downloadBtn        = $('#download-btn');
  const progressWrapper    = $('#progress-wrapper');
  const progressFill       = $('#progress-fill');
  const progressLabel      = $('#progress-label');
  const toastEl            = $('#toast');
  const conversionsGrid    = $('#conversions-grid');

  // Canvas (hidden, used for conversion)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // ============================================
  // Theme Toggle
  // ============================================
  function getPreferredTheme() {
    const saved = localStorage.getItem('fc-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fc-theme', theme);
    themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  applyTheme(getPreferredTheme());

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ============================================
  // SPA Routing
  // ============================================
  const navLinks = $$('[data-page]');
  const pageViews = $$('.page-view');

  function navigateTo(pageId) {
    pageViews.forEach((v) => v.classList.remove('active'));
    const target = $(`#${pageId}`);
    if (target) target.classList.add('active');

    navLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.page === pageId);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.pushState(null, '', `#${pageId}`);
  }

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  window.addEventListener('popstate', () => {
    const hash = location.hash.replace('#', '') || 'page-home';
    navigateTo(hash);
  });

  const initPage = location.hash.replace('#', '') || 'page-home';
  navigateTo(initPage);

  // ============================================
  // Toast Notifications
  // ============================================
  let toastTimeout = null;

  function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    toastEl.textContent = message;
    toastEl.className = 'toast';
    toastEl.classList.add(type, 'visible');
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 3500);
  }

  // ============================================
  // Mode Switching (Convert / Compress)
  // ============================================
  function switchMode(mode) {
    currentMode = mode;

    // Update tabs
    $$('.mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });

    // Show/hide controls
    if (mode === 'convert') {
      convertControls.style.display = '';
      compressControls.classList.remove('visible');
    } else {
      convertControls.style.display = 'none';
      compressControls.classList.add('visible');
    }

    // Update button enable state
    updateActionButtons();

    // Hide previous result
    resultArea.classList.remove('visible');
    progressWrapper.classList.remove('visible');
  }

  $$('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // ============================================
  // Conversion Cards
  // ============================================
  $$('.conversion-card').forEach((card) => {
    card.addEventListener('click', () => {
      // Clear previous active
      $$('.conversion-card').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');

      if (card.dataset.mode === 'compress') {
        // Switch to compress mode
        switchMode('compress');
      } else {
        // Switch to convert mode and set output format
        switchMode('convert');
        if (card.dataset.output) {
          formatSelect.value = card.dataset.output;
          updateQualityVisibility();
        }
      }

      // Scroll to dropzone
      dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // ============================================
  // Size Pills (Compress Mode)
  // ============================================
  $$('.size-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      $$('.size-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      targetCompressSize = parseInt(pill.dataset.size, 10);
    });
  });

  // ============================================
  // File Handling
  // ============================================
  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function isHeicFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    return (
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      ext === 'heic' ||
      ext === 'heif'
    );
  }

  async function handleFile(file) {
    if (!file) return;

    // Check type by extension too (HEIC MIME is sometimes empty)
    const ext = file.name.toLowerCase().split('.').pop();
    const validExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];
    const typeOk = ACCEPTED_TYPES.includes(file.type) || validExts.includes(ext);

    if (!typeOk) {
      showToast('Unsupported format. Please upload PNG, JPG, WebP, or HEIC.', 'error');
      return;
    }



    originalFileSize = file.size;
    convertedBlob = null;

    // Update dropzone UI immediately
    dropzone.classList.add('has-file');
    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);

    // Handle HEIC conversion first
    if (isHeicFile(file)) {
      showToast('Converting HEIC format — please wait…', 'success');
      try {
        const convertedBlobs = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 1,
        });
        // heic2any can return a single blob or an array
        const pngBlob = Array.isArray(convertedBlobs) ? convertedBlobs[0] : convertedBlobs;
        // Create a File-like object
        currentFile = new File([pngBlob], file.name.replace(/\.(heic|heif)$/i, '.png'), {
          type: 'image/png',
        });
        showToast(`"${file.name}" (HEIC) loaded successfully!`, 'success');
      } catch (err) {
        console.error('HEIC conversion error:', err);
        showToast('Failed to decode HEIC file. Please try a different image.', 'error');
        removeFile();
        return;
      }
    } else {
      currentFile = file;
      showToast(`"${file.name}" loaded successfully!`, 'success');
    }

    // Show image preview
    const previewBlob = currentFile;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      imagePreview.style.display = 'flex';
    };
    reader.readAsDataURL(previewBlob);

    // Auto-select a different output format (for convert mode)
    autoSelectFormat(currentFile.type);

    // Enable action buttons
    updateActionButtons();

    // Hide previous result
    resultArea.classList.remove('visible');
    progressWrapper.classList.remove('visible');
  }

  function autoSelectFormat(mimeType) {
    const formatMap = {
      'image/png': 'webp',
      'image/jpeg': 'webp',
      'image/webp': 'png',
    };
    formatSelect.value = formatMap[mimeType] || 'png';
    updateQualityVisibility();
  }

  function updateActionButtons() {
    const hasFile = !!currentFile;
    convertBtn.disabled = !hasFile;
    compressBtn.disabled = !hasFile;
  }

  function removeFile() {
    currentFile = null;
    convertedBlob = null;
    originalFileSize = 0;
    fileInput.value = '';
    dropzone.classList.remove('has-file');
    dropzoneDefault.style.display = '';
    dropzoneFileInfo.style.display = 'none';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    convertBtn.disabled = true;
    compressBtn.disabled = true;
    resultArea.classList.remove('visible');
    progressWrapper.classList.remove('visible');
  }

  // Dropzone events
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('.remove-file')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFile();
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
  });

  // ============================================
  // Format & Quality Controls
  // ============================================
  function updateQualityVisibility() {
    const format = formatSelect.value;
    if (format === 'jpeg' || format === 'webp') {
      qualityControl.classList.add('visible');
    } else {
      qualityControl.classList.remove('visible');
    }
  }

  formatSelect.addEventListener('change', updateQualityVisibility);

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value + '%';
  });

  // ============================================
  // Helper: Load image from File/Blob
  // ============================================
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // ============================================
  // Helper: Canvas to Blob (promisified)
  // ============================================
  function canvasToBlob(targetMime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error('Canvas toBlob failed'));
          else resolve(blob);
        },
        targetMime,
        quality
      );
    });
  }

  // ============================================
  // Image Conversion (Canvas API)
  // ============================================
  async function convertImage() {
    if (!currentFile) return;

    const format = formatSelect.value;
    const quality = parseInt(qualitySlider.value, 10) / 100;

    const mimeMap = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };
    const targetMime = mimeMap[format];

    // Show loading state
    convertBtn.classList.add('loading');
    convertBtn.disabled = true;

    try {
      const img = await loadImageFromFile(currentFile);

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // For JPEG, fill white background (no alpha support)
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const blob = await canvasToBlob(targetMime, format === 'png' ? undefined : quality);

      convertedBlob = blob;

      // Generate output filename
      const baseName = currentFile.name.replace(/\.[^.]+$/, '');
      const ext = format === 'jpeg' ? 'jpg' : format;
      convertedFileName = `${baseName}_converted.${ext}`;

      // Show result (simple mode)
      resultTitle.textContent = 'Conversion Complete!';
      resultFormat.textContent = format.toUpperCase();
      resultSize.textContent = formatBytes(blob.size);
      resultStats.style.display = 'none';
      resultArea.classList.add('visible');

      showToast('Conversion complete! Ready to download.', 'success');
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      console.error('Conversion error:', err);
      showToast('Conversion failed. Please try again.', 'error');
    } finally {
      convertBtn.classList.remove('loading');
      convertBtn.disabled = false;
    }
  }

  convertBtn.addEventListener('click', convertImage);

  // ============================================
  // Compress to Target Size (Binary Search)
  // ============================================
  async function compressToSize() {
    if (!currentFile) return;

    compressBtn.classList.add('loading');
    compressBtn.disabled = true;
    progressWrapper.classList.add('visible');
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Analyzing image…';
    resultArea.classList.remove('visible');

    try {
      const img = await loadImageFromFile(currentFile);

      let bestBlob = null;
      let bestQuality = 0;
      let attempts = 0;
      const maxAttempts = 20;

      // Try JPEG first (best compression ratio)
      const targetMime = 'image/jpeg';
      let currentWidth = img.naturalWidth;
      let currentHeight = img.naturalHeight;

      // Phase 1: Binary search on quality at full resolution
      let low = 0.01;
      let high = 0.95;

      progressLabel.textContent = 'Optimizing quality…';

      for (let i = 0; i < 12; i++) {
        attempts++;
        const mid = (low + high) / 2;

        canvas.width = currentWidth;
        canvas.height = currentHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

        const blob = await canvasToBlob(targetMime, mid);
        const progress = Math.min(30 + (i / 12) * 40, 70);
        progressFill.style.width = progress + '%';

        if (blob.size <= targetCompressSize) {
          bestBlob = blob;
          bestQuality = mid;
          low = mid; // Try higher quality
        } else {
          high = mid; // Try lower quality
        }
      }

      // Phase 2: If even lowest quality is too big, scale down dimensions
      if (!bestBlob) {
        progressLabel.textContent = 'Reducing dimensions…';
        let scale = 0.9;

        while (scale >= 0.05 && attempts < maxAttempts) {
          attempts++;
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);

          canvas.width = w;
          canvas.height = h;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          // Try with medium-low quality
          const blob = await canvasToBlob(targetMime, 0.4);
          const progress = Math.min(70 + ((0.9 - scale) / 0.85) * 25, 95);
          progressFill.style.width = progress + '%';

          if (blob.size <= targetCompressSize) {
            bestBlob = blob;
            // Now try to find a higher quality at this scale
            let qLow = 0.4;
            let qHigh = 0.95;
            for (let j = 0; j < 6; j++) {
              const qMid = (qLow + qHigh) / 2;
              canvas.width = w;
              canvas.height = h;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              const qBlob = await canvasToBlob(targetMime, qMid);
              if (qBlob.size <= targetCompressSize) {
                bestBlob = qBlob;
                qLow = qMid;
              } else {
                qHigh = qMid;
              }
            }
            break;
          }
          scale -= 0.1;
        }
      }

      progressFill.style.width = '100%';
      progressLabel.textContent = 'Done!';

      if (bestBlob) {
        convertedBlob = bestBlob;
        const baseName = currentFile.name.replace(/\.[^.]+$/, '');
        convertedFileName = `${baseName}_compressed.jpg`;

        // Show result with compression stats
        resultTitle.textContent = 'Compression Complete!';
        resultFormat.textContent = 'JPG';
        resultSize.textContent = formatBytes(bestBlob.size);

        statOriginal.textContent = formatBytes(originalFileSize);
        statCompressed.textContent = formatBytes(bestBlob.size);
        const savedPct = ((1 - bestBlob.size / originalFileSize) * 100).toFixed(1);
        statSavings.textContent = savedPct + '%';
        resultStats.style.display = '';

        resultArea.classList.add('visible');
        showToast(`Compressed to ${formatBytes(bestBlob.size)} (${savedPct}% saved)!`, 'success');
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showToast('Could not compress to the target size. Try a larger target.', 'error');
      }
    } catch (err) {
      console.error('Compression error:', err);
      showToast('Compression failed. Please try again.', 'error');
    } finally {
      compressBtn.classList.remove('loading');
      compressBtn.disabled = false;
      setTimeout(() => {
        progressWrapper.classList.remove('visible');
      }, 1500);
    }
  }

  compressBtn.addEventListener('click', compressToSize);

  // ============================================
  // Download
  // ============================================
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!convertedBlob) return;

    const url = URL.createObjectURL(convertedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast('Download started!', 'success');
  });



  // ============================================
  // Keyboard Accessibility
  // ============================================
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // ============================================
  // Initialize
  // ============================================
  updateQualityVisibility();
  switchMode('convert');

  // ============================================
  // ============================================
  //       PDF UTILITIES MODULE
  // ============================================
  // ============================================

  const { PDFDocument } = PDFLib;

  // --- PDF State ---
  let pdfCurrentTool = null;    // 'merge' | 'split' | 'compress' | 'img2pdf'
  let pdfFiles = [];            // Array of { file: File, name, size }
  let pdfSplitMode = 'all';     // 'all' | 'range'
  let pdfResultBlobs = [];      // Array of { blob, name }

  // --- PDF DOM References ---
  const catTabs           = $$('.category-tab');
  const catPanels         = $$('.category-panel');
  const pdfToolCards      = $$('.pdf-tool-card');
  const pdfWorkspace      = $('#pdf-workspace');
  const pdfWorkspaceTitle = $('#pdf-workspace-title');
  const pdfWorkspaceSub   = $('#pdf-workspace-subtitle');
  const pdfDropzone       = $('#pdf-dropzone');
  const pdfFileInput      = $('#pdf-file-input');
  const pdfDropzoneText   = $('#pdf-dropzone-text');
  const pdfDropzoneHint   = $('#pdf-dropzone-hint');
  const pdfFileListEl     = $('#pdf-file-list');
  const pdfFileCountEl    = $('#pdf-file-count');
  const pdfActionBtn      = $('#pdf-action-btn');
  const pdfActionText     = $('#pdf-action-text');
  const pdfProgressWrap   = $('#pdf-progress-wrapper');
  const pdfProgressFill   = $('#pdf-progress-fill');
  const pdfProgressLabel  = $('#pdf-progress-label');
  const pdfResultArea     = $('#pdf-result-area');
  const pdfResultTitle    = $('#pdf-result-title');
  const pdfResultMeta     = $('#pdf-result-meta');
  const pdfResultDownloads = $('#pdf-result-downloads');
  const pdfSplitControls  = $('#pdf-split-controls');
  const pdfCompressControls = $('#pdf-compress-controls');
  const pdfImg2pdfControls = $('#pdf-img2pdf-controls');
  const pdfPageInfo       = $('#pdf-page-info');
  const pageRangeWrapper  = $('#page-range-wrapper');
  const pageRangeInput    = $('#page-range');
  const splitModePills    = $$('.split-pill');
  const pdfCompressLevel  = $('#pdf-compress-level');
  const img2pdfPageSize   = $('#img2pdf-page-size');
  const img2pdfOrientation = $('#img2pdf-orientation');

  // ============================================
  // Category Tab Switching
  // ============================================
  function switchCategory(category) {
    catTabs.forEach(t => t.classList.toggle('active', t.dataset.category === category));
    catPanels.forEach(p => {
      p.classList.toggle('active', p.id === `panel-${category}`);
    });
  }

  catTabs.forEach(tab => {
    tab.addEventListener('click', () => switchCategory(tab.dataset.category));
  });

  // Footer PDF nav links
  $$('[data-pdf-nav]').forEach(link => {
    link.addEventListener('click', (e) => {
      // After navigating to home, switch to PDF panel and select tool
      setTimeout(() => {
        switchCategory('pdf');
        selectPdfTool(link.dataset.pdfNav);
      }, 100);
    });
  });

  // ============================================
  // PDF Tool Selection
  // ============================================
  const toolConfig = {
    merge: {
      title: 'Merge PDFs',
      subtitle: 'Add 2 or more PDF files to combine',
      dropText: 'Drag & drop your PDF files here',
      dropHint: 'or click to browse · Add multiple PDFs',
      accept: '.pdf,application/pdf',
      multiple: true,
      actionText: 'Merge PDFs',
      minFiles: 2,
    },
    split: {
      title: 'Split PDF',
      subtitle: 'Add a PDF file to extract pages from',
      dropText: 'Drag & drop your PDF file here',
      dropHint: 'or click to browse · Single PDF',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionText: 'Split PDF',
      minFiles: 1,
    },
    compress: {
      title: 'Compress PDF',
      subtitle: 'Add a PDF file to reduce its size',
      dropText: 'Drag & drop your PDF file here',
      dropHint: 'or click to browse · Single PDF',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionText: 'Compress PDF',
      minFiles: 1,
    },
    img2pdf: {
      title: 'Images to PDF',
      subtitle: 'Add images to convert into a PDF document',
      dropText: 'Drag & drop your images here',
      dropHint: 'or click to browse · JPG, PNG, WebP',
      accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
      multiple: true,
      actionText: 'Create PDF',
      minFiles: 1,
    },
  };

  function selectPdfTool(tool) {
    pdfCurrentTool = tool;
    const config = toolConfig[tool];

    // Highlight active card
    pdfToolCards.forEach(c => c.classList.toggle('active', c.dataset.pdfTool === tool));

    // Show workspace
    pdfWorkspace.classList.add('visible');
    pdfWorkspaceTitle.textContent = config.title;
    pdfWorkspaceSub.textContent = config.subtitle;

    // Configure dropzone
    pdfDropzoneText.textContent = config.dropText;
    pdfDropzoneHint.textContent = config.dropHint;
    pdfFileInput.accept = config.accept;
    pdfFileInput.multiple = config.multiple;

    // Update action button text
    pdfActionText.textContent = config.actionText;

    // Show/hide tool-specific controls
    pdfSplitControls.classList.toggle('visible', tool === 'split');
    pdfCompressControls.classList.toggle('visible', tool === 'compress');
    pdfImg2pdfControls.classList.toggle('visible', tool === 'img2pdf');

    // Update dropzone badge
    const badgeContainer = pdfDropzone.querySelector('.format-badges');
    if (tool === 'img2pdf') {
      badgeContainer.innerHTML = '<span class="pdf-format-badge">JPG</span><span class="pdf-format-badge">PNG</span><span class="pdf-format-badge">WebP</span>';
    } else {
      badgeContainer.innerHTML = '<span class="pdf-format-badge">PDF</span>';
    }

    // Clear files and results
    clearPdfFiles();

    // Scroll to workspace
    pdfWorkspace.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  pdfToolCards.forEach(card => {
    card.addEventListener('click', () => selectPdfTool(card.dataset.pdfTool));
  });

  // ============================================
  // PDF File Handling
  // ============================================
  function clearPdfFiles() {
    pdfFiles = [];
    pdfResultBlobs = [];
    pdfFileListEl.innerHTML = '';
    pdfFileCountEl.textContent = '';
    pdfActionBtn.disabled = true;
    pdfResultArea.classList.remove('visible');
    pdfProgressWrap.classList.remove('visible');
    pdfPageInfo.textContent = '';
  }

  function addPdfFiles(newFiles) {
    const config = toolConfig[pdfCurrentTool];

    for (const file of newFiles) {
      // Validate file type
      if (pdfCurrentTool === 'img2pdf') {
        if (!file.type.startsWith('image/')) {
          showToast(`"${file.name}" is not an image file.`, 'error');
          continue;
        }
      } else {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          showToast(`"${file.name}" is not a PDF file.`, 'error');
          continue;
        }
      }

      // For single-file tools, replace existing
      if (!config.multiple) {
        pdfFiles = [];
        pdfFileListEl.innerHTML = '';
      }

      pdfFiles.push({ file, name: file.name, size: file.size });
    }

    renderPdfFileList();
    updatePdfActionState();

    // If split tool, load page count
    if (pdfCurrentTool === 'split' && pdfFiles.length === 1) {
      loadPdfPageCount(pdfFiles[0].file);
    }
  }

  function removePdfFile(index) {
    pdfFiles.splice(index, 1);
    renderPdfFileList();
    updatePdfActionState();
    if (pdfCurrentTool === 'split') {
      pdfPageInfo.textContent = '';
    }
  }

  function renderPdfFileList() {
    pdfFileListEl.innerHTML = '';

    pdfFiles.forEach((pf, i) => {
      const item = document.createElement('div');
      item.className = 'pdf-file-item';
      item.draggable = true;
      item.dataset.index = i;

      const isImg = pdfCurrentTool === 'img2pdf';
      const icon = isImg ? '🖼️' : '📄';

      item.innerHTML = `
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="file-icon">${icon}</span>
        <div class="file-details">
          <p class="file-name">${pf.name}</p>
          <p class="file-meta">${formatBytes(pf.size)}</p>
        </div>
        <button class="remove-btn" title="Remove file">✕</button>
      `;

      // Remove button
      item.querySelector('.remove-btn').addEventListener('click', () => removePdfFile(i));

      // Drag handlers
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', i.toString());
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const to = i;
        if (from !== to) {
          const [moved] = pdfFiles.splice(from, 1);
          pdfFiles.splice(to, 0, moved);
          renderPdfFileList();
        }
      });

      pdfFileListEl.appendChild(item);
    });

    // File count
    if (pdfFiles.length > 0) {
      pdfFileCountEl.textContent = `${pdfFiles.length} file${pdfFiles.length > 1 ? 's' : ''} added`;
    } else {
      pdfFileCountEl.textContent = '';
    }
  }

  function updatePdfActionState() {
    if (!pdfCurrentTool) return;
    const config = toolConfig[pdfCurrentTool];
    pdfActionBtn.disabled = pdfFiles.length < config.minFiles;
  }

  async function loadPdfPageCount(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const count = pdf.getPageCount();
      pdfPageInfo.innerHTML = `This PDF has <strong>${count}</strong> page${count > 1 ? 's' : ''}`;
    } catch (err) {
      pdfPageInfo.textContent = 'Could not read page count';
      console.error(err);
    }
  }

  // PDF Dropzone Events
  pdfDropzone.addEventListener('click', (e) => {
    if (e.target.closest('.remove-btn')) return;
    pdfFileInput.click();
  });

  pdfFileInput.addEventListener('change', () => {
    if (pdfFileInput.files.length) {
      addPdfFiles(Array.from(pdfFileInput.files));
      pdfFileInput.value = '';
    }
  });

  ['dragenter', 'dragover'].forEach(evt => {
    pdfDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      pdfDropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    pdfDropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      pdfDropzone.classList.remove('drag-over');
    });
  });

  pdfDropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) addPdfFiles(Array.from(files));
  });

  pdfDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pdfFileInput.click();
    }
  });

  // Split Mode Pills
  splitModePills.forEach(pill => {
    pill.addEventListener('click', () => {
      pdfSplitMode = pill.dataset.splitMode;
      splitModePills.forEach(p => p.classList.toggle('active', p === pill));
      pageRangeWrapper.style.display = pdfSplitMode === 'range' ? '' : 'none';
    });
  });

  // ============================================
  // PDF Action Dispatcher
  // ============================================
  pdfActionBtn.addEventListener('click', async () => {
    if (!pdfCurrentTool || pdfFiles.length === 0) return;

    pdfActionBtn.classList.add('loading');
    pdfActionBtn.disabled = true;
    pdfResultArea.classList.remove('visible');
    pdfProgressWrap.classList.add('visible');
    pdfProgressFill.style.width = '0%';
    pdfProgressLabel.textContent = 'Starting…';

    try {
      switch (pdfCurrentTool) {
        case 'merge':
          await pdfMerge();
          break;
        case 'split':
          await pdfSplit();
          break;
        case 'compress':
          await pdfCompress();
          break;
        case 'img2pdf':
          await pdfImgToPdf();
          break;
      }
    } catch (err) {
      console.error('PDF operation error:', err);
      showToast('Operation failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      pdfActionBtn.classList.remove('loading');
      updatePdfActionState();
      setTimeout(() => {
        pdfProgressWrap.classList.remove('visible');
      }, 1200);
    }
  });

  // ============================================
  // Helper: Show PDF Result
  // ============================================
  function showPdfResult(title, meta, downloads) {
    pdfResultTitle.textContent = title;
    pdfResultMeta.innerHTML = meta;
    pdfResultDownloads.innerHTML = '';

    downloads.forEach(dl => {
      const btn = document.createElement('button');
      btn.className = 'btn-pdf-download';
      btn.innerHTML = `⬇️ ${dl.label}`;
      btn.addEventListener('click', () => {
        const url = URL.createObjectURL(dl.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = dl.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Download started!', 'success');
      });
      pdfResultDownloads.appendChild(btn);
    });

    pdfResultArea.classList.add('visible');
    pdfProgressFill.style.width = '100%';
    pdfProgressLabel.textContent = 'Done!';
    pdfResultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ============================================
  // MERGE PDFs
  // ============================================
  async function pdfMerge() {
    pdfProgressLabel.textContent = 'Merging PDFs…';
    const mergedPdf = await PDFDocument.create();

    for (let i = 0; i < pdfFiles.length; i++) {
      pdfProgressFill.style.width = `${(i / pdfFiles.length) * 90}%`;
      pdfProgressLabel.textContent = `Processing file ${i + 1} of ${pdfFiles.length}…`;

      const arrayBuffer = await pdfFiles[i].file.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });

    showPdfResult(
      'Merge Complete!',
      `Size: <span>${formatBytes(blob.size)}</span> · Pages: <span>${mergedPdf.getPageCount()}</span>`,
      [{ blob, name: 'merged.pdf', label: 'Download Merged PDF' }]
    );

    showToast(`Merged ${pdfFiles.length} PDFs successfully!`, 'success');
  }

  // ============================================
  // SPLIT PDF
  // ============================================
  function parsePageRanges(input, maxPage) {
    const ranges = [];
    const parts = input.split(',').map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map(s => s.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < 1 || end > maxPage || start > end) {
          throw new Error(`Invalid range: ${part}`);
        }
        const pages = [];
        for (let p = start; p <= end; p++) pages.push(p - 1); // 0-indexed
        ranges.push({ label: `pages_${start}-${end}`, pages });
      } else {
        const page = parseInt(part, 10);
        if (isNaN(page) || page < 1 || page > maxPage) {
          throw new Error(`Invalid page: ${part}`);
        }
        ranges.push({ label: `page_${page}`, pages: [page - 1] });
      }
    }

    return ranges;
  }

  async function pdfSplit() {
    pdfProgressLabel.textContent = 'Loading PDF…';
    const arrayBuffer = await pdfFiles[0].file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const pageCount = srcPdf.getPageCount();

    let ranges;
    if (pdfSplitMode === 'all') {
      // Each page becomes its own PDF
      ranges = [];
      for (let i = 0; i < pageCount; i++) {
        ranges.push({ label: `page_${i + 1}`, pages: [i] });
      }
    } else {
      const rangeText = pageRangeInput.value.trim();
      if (!rangeText) {
        showToast('Please enter page ranges (e.g. 1-3, 5, 7-10)', 'error');
        return;
      }
      ranges = parsePageRanges(rangeText, pageCount);
    }

    const downloads = [];

    for (let i = 0; i < ranges.length; i++) {
      pdfProgressFill.style.width = `${(i / ranges.length) * 90}%`;
      pdfProgressLabel.textContent = `Extracting ${ranges[i].label}…`;

      const newPdf = await PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcPdf, ranges[i].pages);
      copiedPages.forEach(p => newPdf.addPage(p));
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });

      const baseName = pdfFiles[0].name.replace(/\.pdf$/i, '');
      downloads.push({
        blob,
        name: `${baseName}_${ranges[i].label}.pdf`,
        label: `Download ${ranges[i].label}.pdf (${formatBytes(blob.size)})`,
      });
    }

    showPdfResult(
      'Split Complete!',
      `Created <span>${downloads.length}</span> PDF file${downloads.length > 1 ? 's' : ''} from ${pageCount} pages`,
      downloads
    );

    showToast(`Split into ${downloads.length} files!`, 'success');
  }

  // ============================================
  // COMPRESS PDF
  // ============================================
  async function pdfCompress() {
    pdfProgressLabel.textContent = 'Loading PDF…';
    const originalSize = pdfFiles[0].size;
    const arrayBuffer = await pdfFiles[0].file.arrayBuffer();
    const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const level = pdfCompressLevel.value;

    pdfProgressLabel.textContent = 'Compressing…';
    pdfProgressFill.style.width = '30%';

    // Compression strategy: create a new PDF, copy pages (strips unused objects)
    const compressedPdf = await PDFDocument.create();
    const allPages = await compressedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
    allPages.forEach(page => compressedPdf.addPage(page));

    pdfProgressFill.style.width = '60%';
    pdfProgressLabel.textContent = 'Optimizing…';

    // Strip metadata for additional savings
    compressedPdf.setTitle('');
    compressedPdf.setAuthor('');
    compressedPdf.setSubject('');
    compressedPdf.setKeywords([]);
    compressedPdf.setProducer('FastConvert');
    compressedPdf.setCreator('FastConvert');

    pdfProgressFill.style.width = '80%';

    // Save with different options based on compression level
    let saveOptions = {};
    if (level === 'high') {
      saveOptions = { useObjectStreams: true };
    } else if (level === 'medium') {
      saveOptions = { useObjectStreams: true };
    }

    const compressedBytes = await compressedPdf.save(saveOptions);
    const blob = new Blob([compressedBytes], { type: 'application/pdf' });

    const savedPct = ((1 - blob.size / originalSize) * 100).toFixed(1);
    const baseName = pdfFiles[0].name.replace(/\.pdf$/i, '');

    showPdfResult(
      'Compression Complete!',
      `Original: <span>${formatBytes(originalSize)}</span> → Compressed: <span>${formatBytes(blob.size)}</span> · Saved: <span>${savedPct}%</span>`,
      [{ blob, name: `${baseName}_compressed.pdf`, label: 'Download Compressed PDF' }]
    );

    showToast(`Compressed! Saved ${savedPct}%`, 'success');
  }

  // ============================================
  // IMAGES TO PDF
  // ============================================
  async function pdfImgToPdf() {
    pdfProgressLabel.textContent = 'Creating PDF…';
    const pdfDoc = await PDFDocument.create();
    const pageSize = img2pdfPageSize.value;
    const orientation = img2pdfOrientation.value;

    // Page dimensions in points (72 points = 1 inch)
    const pageSizes = {
      a4: { w: 595.28, h: 841.89 },    // 210mm × 297mm
      letter: { w: 612, h: 792 },       // 8.5" × 11"
    };

    for (let i = 0; i < pdfFiles.length; i++) {
      pdfProgressFill.style.width = `${(i / pdfFiles.length) * 90}%`;
      pdfProgressLabel.textContent = `Processing image ${i + 1} of ${pdfFiles.length}…`;

      const file = pdfFiles[i].file;
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let image;
      if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(bytes);
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await pdfDoc.embedJpg(bytes);
      } else {
        // For WebP or other formats, convert to PNG via canvas
        const imgEl = await loadImageFromUrl(URL.createObjectURL(file));
        const cnv = document.createElement('canvas');
        cnv.width = imgEl.naturalWidth;
        cnv.height = imgEl.naturalHeight;
        const c = cnv.getContext('2d');
        c.drawImage(imgEl, 0, 0);
        const pngBlob = await new Promise(resolve => cnv.toBlob(resolve, 'image/png'));
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        image = await pdfDoc.embedPng(pngBytes);
      }

      const imgWidth = image.width;
      const imgHeight = image.height;

      let pw, ph;
      if (pageSize === 'fit') {
        pw = imgWidth;
        ph = imgHeight;
      } else {
        const dims = pageSizes[pageSize];
        if (orientation === 'landscape') {
          pw = dims.h;
          ph = dims.w;
        } else {
          pw = dims.w;
          ph = dims.h;
        }
      }

      const page = pdfDoc.addPage([pw, ph]);

      // Scale image to fit page while maintaining aspect ratio
      if (pageSize === 'fit') {
        page.drawImage(image, { x: 0, y: 0, width: pw, height: ph });
      } else {
        const scale = Math.min(pw / imgWidth, ph / imgHeight);
        const scaledW = imgWidth * scale;
        const scaledH = imgHeight * scale;
        const x = (pw - scaledW) / 2;
        const y = (ph - scaledH) / 2;
        page.drawImage(image, { x, y, width: scaledW, height: scaledH });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    showPdfResult(
      'PDF Created!',
      `Size: <span>${formatBytes(blob.size)}</span> · Pages: <span>${pdfFiles.length}</span>`,
      [{ blob, name: 'images_combined.pdf', label: 'Download PDF' }]
    );

    showToast(`Created PDF with ${pdfFiles.length} page${pdfFiles.length > 1 ? 's' : ''}!`, 'success');
  }

  // Helper: load image from URL
  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

})();
