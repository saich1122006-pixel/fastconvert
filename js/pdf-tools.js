(function () {
  'use strict';

  const { PDFDocument } = window.PDFLib;

  // Read the active tool from a data attribute on the body or workspace
  const pdfWorkspace = $('#pdf-workspace');
  if (!pdfWorkspace) return;

  const pdfCurrentTool = pdfWorkspace.dataset.tool; // 'merge' | 'split' | 'compress' | 'img2pdf'
  
  // --- PDF State ---
  let pdfFiles = [];
  let pdfSplitMode = 'all'; // 'all' | 'range'

  // --- DOM References ---
  const pdfDropzone       = $('#pdf-dropzone');
  const pdfFileInput      = $('#pdf-file-input');
  const pdfFileListEl     = $('#pdf-file-list');
  const pdfFileCountEl    = $('#pdf-file-count');
  const pdfActionBtn      = $('#pdf-action-btn');
  const pdfProgressWrap   = $('#pdf-progress-wrapper');
  const pdfProgressFill   = $('#pdf-progress-fill');
  const pdfProgressLabel  = $('#pdf-progress-label');
  const pdfResultArea     = $('#pdf-result-area');
  const pdfResultTitle    = $('#pdf-result-title');
  const pdfResultMeta     = $('#pdf-result-meta');
  const pdfResultDownloads = $('#pdf-result-downloads');
  const pdfPageInfo       = $('#pdf-page-info');
  const pageRangeWrapper  = $('#page-range-wrapper');
  const pageRangeInput    = $('#page-range');
  const splitModePills    = $$('.split-pill');
  const pdfCompressLevel  = $('#pdf-compress-level');
  const img2pdfPageSize   = $('#img2pdf-page-size');
  const img2pdfOrientation = $('#img2pdf-orientation');

  const toolConfig = {
    merge: { multiple: true, minFiles: 2 },
    split: { multiple: false, minFiles: 1 },
    compress: { multiple: false, minFiles: 1 },
    img2pdf: { multiple: true, minFiles: 1 },
  };

  const config = toolConfig[pdfCurrentTool];
  if (!config) return;

  // ============================================
  // PDF File Handling
  // ============================================
  function clearPdfFiles() {
    pdfFiles = [];
    pdfFileListEl.innerHTML = '';
    pdfFileCountEl.textContent = '';
    pdfActionBtn.disabled = true;
    pdfResultArea.classList.remove('visible');
    pdfProgressWrap.classList.remove('visible');
    if (pdfPageInfo) pdfPageInfo.textContent = '';
  }

  function addPdfFiles(newFiles) {
    for (const file of newFiles) {
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

      if (!config.multiple) {
        pdfFiles = [];
        pdfFileListEl.innerHTML = '';
      }

      pdfFiles.push({ file, name: file.name, size: file.size });
    }

    renderPdfFileList();
    updatePdfActionState();

    if (pdfCurrentTool === 'split' && pdfFiles.length === 1) {
      loadPdfPageCount(pdfFiles[0].file);
    }
  }

  function removePdfFile(index) {
    pdfFiles.splice(index, 1);
    renderPdfFileList();
    updatePdfActionState();
    if (pdfCurrentTool === 'split') {
      if (pdfPageInfo) pdfPageInfo.textContent = '';
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

      item.querySelector('.remove-btn').addEventListener('click', () => removePdfFile(i));

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
        if (from !== to && !isNaN(from)) {
          const [moved] = pdfFiles.splice(from, 1);
          pdfFiles.splice(to, 0, moved);
          renderPdfFileList();
        }
      });

      pdfFileListEl.appendChild(item);
    });

    if (pdfFiles.length > 0) {
      pdfFileCountEl.textContent = `${pdfFiles.length} file${pdfFiles.length > 1 ? 's' : ''} added`;
    } else {
      pdfFileCountEl.textContent = '';
    }
  }

  function updatePdfActionState() {
    pdfActionBtn.disabled = pdfFiles.length < config.minFiles;
  }

  async function loadPdfPageCount(file) {
    if (!pdfPageInfo) return;
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
  if (pdfDropzone) {
    pdfDropzone.addEventListener('click', (e) => {
      if (e.target.closest('.remove-btn')) return;
      pdfFileInput.click();
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
  }

  if (pdfFileInput) {
    pdfFileInput.addEventListener('change', () => {
      if (pdfFileInput.files.length) {
        addPdfFiles(Array.from(pdfFileInput.files));
        pdfFileInput.value = '';
      }
    });
  }

  // Split Mode Pills
  if (splitModePills) {
    splitModePills.forEach(pill => {
      pill.addEventListener('click', () => {
        pdfSplitMode = pill.dataset.splitMode;
        splitModePills.forEach(p => p.classList.toggle('active', p === pill));
        if (pageRangeWrapper) {
          pageRangeWrapper.style.display = pdfSplitMode === 'range' ? '' : 'none';
        }
      });
    });
  }

  // ============================================
  // PDF Action Dispatcher
  // ============================================
  if (pdfActionBtn) {
    pdfActionBtn.addEventListener('click', async () => {
      if (pdfFiles.length === 0) return;

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
  }

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
        for (let p = start; p <= end; p++) pages.push(p - 1);
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
    const level = pdfCompressLevel ? pdfCompressLevel.value : 'medium';

    pdfProgressLabel.textContent = 'Compressing…';
    pdfProgressFill.style.width = '30%';

    const compressedPdf = await PDFDocument.create();
    const allPages = await compressedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
    allPages.forEach(page => compressedPdf.addPage(page));

    pdfProgressFill.style.width = '60%';
    pdfProgressLabel.textContent = 'Optimizing…';

    compressedPdf.setTitle('');
    compressedPdf.setAuthor('');
    compressedPdf.setSubject('');
    compressedPdf.setKeywords([]);
    compressedPdf.setProducer('FastConvert');
    compressedPdf.setCreator('FastConvert');

    pdfProgressFill.style.width = '80%';

    let saveOptions = {};
    if (level === 'high' || level === 'medium') {
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
    const pageSize = img2pdfPageSize ? img2pdfPageSize.value : 'a4';
    const orientation = img2pdfOrientation ? img2pdfOrientation.value : 'portrait';

    const pageSizes = {
      a4: { w: 595.28, h: 841.89 },
      letter: { w: 612, h: 792 },
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

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

})();
