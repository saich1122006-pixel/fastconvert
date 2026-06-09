(function () {
  'use strict';

  // --- State ---
  let files = [];
  let currentMode = null; // 'image', 'pdf', 'mixed'

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  
  const fileInput          = $('#smart-file-input');
  const dropzone           = $('#smart-dropzone');
  const dropzoneDefault    = $('#smart-dropzone-default');
  const dropzoneInfo       = $('#smart-dropzone-info');
  const fileListEl         = $('#smart-file-list');
  const clearBtn           = $('#smart-clear-files');
  const addMoreBtn         = $('#smart-add-more-files');
  
  const actionsArea        = $('#smart-actions-area');
  const actionsImage       = $('#smart-actions-image');
  const actionsPdf         = $('#smart-actions-pdf');
  const actionsMixed       = $('#smart-actions-mixed');
  
  // Image Controls
  const imgFormatSelect    = $('#smart-format-select');
  const imgQualityControl  = $('#smart-quality-control');
  const imgQualitySlider   = $('#smart-quality-slider');
  const imgQualityValue    = $('#smart-quality-value');
  const imgConvertBtn      = $('#smart-convert-btn');
  const imgCompressBtn     = $('#smart-compress-img-btn');
  const sizePills          = document.querySelectorAll('.size-pill');
  let targetCompressSize   = 51200; // 50KB default

  // PDF Controls
  const pdfCompressBtn     = $('#smart-pdf-compress');
  const pdfSplitBtn        = $('#smart-pdf-split');
  const pdfMergeBtn        = $('#smart-pdf-merge');
  const imgToPdfBtn        = $('#smart-img-to-pdf');

  // Progress & Result
  const progressWrapper    = $('#smart-progress-wrapper');
  const progressFill       = $('#smart-progress-fill');
  const progressLabel      = $('#smart-progress-label');
  const resultArea         = $('#smart-result-area');
  const resultTitle        = $('#smart-result-title');
  const resultMeta         = $('#smart-result-meta');
  const resultDownloads    = $('#smart-result-downloads');

  // Canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  function showToast(message, type = 'success') {
    const toastEl = $('#toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = 'toast';
    toastEl.classList.add(type, 'visible');
    setTimeout(() => toastEl.classList.remove('visible'), 3500);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  // ============================================
  // File Handling & Smart Detection
  // ============================================
  
  function getFileTypeCategory(file) {
    const type = file.type.toLowerCase();
    const ext = file.name.split('.').pop().toLowerCase();
    if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (type.startsWith('image/') || ['jpg','jpeg','png','webp','heic','heif'].includes(ext)) return 'image';
    return 'unknown';
  }

  async function handleFiles(newFiles) {
    for (const file of newFiles) {
      const category = getFileTypeCategory(file);
      if (category === 'unknown') {
        showToast(`Skipped ${file.name} - Unsupported format.`, 'error');
        continue;
      }
      
      let processedFile = file;
      
      // Auto convert HEIC to PNG in memory so tools don't fail
      if (file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic') {
        showToast(`Decoding ${file.name}…`, 'success');
        try {
          if (typeof heic2any !== 'undefined') {
            const blob = await heic2any({ blob: file, toType: 'image/png', quality: 1 });
            const pngBlob = Array.isArray(blob) ? blob[0] : blob;
            processedFile = new File([pngBlob], file.name.replace(/\.(heic|heif)$/i, '.png'), { type: 'image/png' });
          } else {
             showToast('HEIC decoder not loaded.', 'error');
             continue;
          }
        } catch(e) {
          showToast(`Failed to decode ${file.name}`, 'error');
          continue;
        }
      }
      
      files.push({ file: processedFile, category });
    }
    
    updateUI();
  }

  function updateUI() {
    if (files.length === 0) {
      dropzone.classList.remove('has-file');
      dropzoneDefault.style.display = 'block';
      dropzoneInfo.style.display = 'none';
      actionsArea.style.display = 'none';
      resultArea.style.display = 'none';
      return;
    }

    dropzone.classList.add('has-file');
    dropzoneDefault.style.display = 'none';
    dropzoneInfo.style.display = 'flex';
    
    // Render file list
    fileListEl.innerHTML = '';
    let hasImage = false;
    let hasPdf = false;
    
    files.forEach((item, index) => {
      if (item.category === 'image') hasImage = true;
      if (item.category === 'pdf') hasPdf = true;
      
      const icon = item.category === 'pdf' ? '📄' : '🖼️';
      const fileDiv = document.createElement('div');
      fileDiv.style.cssText = "display:flex; justify-content:space-between; align-items:center; width:100%; max-width:300px; background:var(--clr-bg-primary); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--clr-border);";
      fileDiv.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${icon} ${escapeHtml(item.file.name)}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="color:var(--clr-text-tertiary); font-size:0.85rem;">${formatBytes(item.file.size)}</span>
          <button class="remove-individual-file" data-index="${index}" style="background:none; border:none; color:var(--clr-text-tertiary); cursor:pointer; font-size:1.1rem; padding:0 4px;" aria-label="Remove file">✕</button>
        </div>
      `;
      fileListEl.appendChild(fileDiv);
    });

    document.querySelectorAll('.remove-individual-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        files.splice(idx, 1);
        updateUI();
      });
    });

    // Show Smart Actions
    actionsArea.style.display = 'block';
    actionsImage.style.display = 'none';
    actionsPdf.style.display = 'none';
    actionsMixed.style.display = 'none';
    
    if (hasImage && !hasPdf) {
      currentMode = 'image';
      actionsImage.style.display = 'flex';
      actionsMixed.style.display = 'flex'; // Allow image -> PDF
      if (files.length > 1) {
        // Can't easily use simple convert/compress on multiple images yet, but let's allow it or suggest Image to PDF
        imgConvertBtn.textContent = `Convert ${files.length} Images`;
        imgCompressBtn.textContent = `Compress ${files.length} Images`;
      } else {
        imgConvertBtn.textContent = `Convert Image`;
        imgCompressBtn.textContent = `Compress Image`;
      }
      autoSelectFormat(files[0].file.type);
    } else if (hasPdf && !hasImage) {
      currentMode = 'pdf';
      actionsPdf.style.display = 'flex';
      pdfMergeBtn.style.display = files.length > 1 ? 'block' : 'none';
      pdfSplitBtn.style.display = files.length === 1 ? 'block' : 'none';
      pdfCompressBtn.style.display = files.length === 1 ? 'block' : 'none';
    } else {
      currentMode = 'mixed';
      actionsMixed.style.display = 'flex';
      showToast('Mixed files detected. You can convert them to a single PDF.', 'success');
    }
  }

  function autoSelectFormat(mimeType) {
    const map = { 'image/png': 'webp', 'image/jpeg': 'webp', 'image/webp': 'png' };
    imgFormatSelect.value = map[mimeType] || 'png';
    updateQualityVisibility();
  }

  function updateQualityVisibility() {
    const f = imgFormatSelect.value;
    imgQualityControl.style.display = (f === 'jpeg' || f === 'webp') ? 'flex' : 'none';
  }

  imgFormatSelect.addEventListener('change', updateQualityVisibility);
  imgQualitySlider.addEventListener('input', () => { imgQualityValue.textContent = imgQualitySlider.value + '%'; });

  sizePills.forEach(pill => {
    pill.addEventListener('click', () => {
      sizePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      targetCompressSize = parseInt(pill.dataset.size, 10);
    });
  });

  // Dropzone Events
  dropzone.addEventListener('click', e => {
    if (e.target.closest('#smart-clear-files') || e.target.closest('#smart-add-more-files') || e.target.closest('.remove-individual-file')) return;
    fileInput.click();
  });
  
  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', e => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    files = [];
    fileInput.value = '';
    updateUI();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFiles(Array.from(fileInput.files));
  });

  ['dragenter', 'dragover'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, ev => { ev.preventDefault(); dropzone.classList.remove('drag-over'); }));
  dropzone.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files)); });

  // ============================================
  // Image Conversion Logic
  // ============================================
  
  function loadImage(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = e.target.result; };
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }
  
  function toBlob(mime, qual) {
    return new Promise((res, rej) => { canvas.toBlob(b => b ? res(b) : rej(), mime, qual); });
  }

  imgConvertBtn.addEventListener('click', async () => {
    if (!files.length) return;
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Converting...';
    resultArea.style.display = 'none';
    
    const format = imgFormatSelect.value;
    const quality = parseInt(imgQualitySlider.value, 10) / 100;
    const targetMime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const downloads = [];

    for(let i=0; i<files.length; i++) {
      progressFill.style.width = `${(i/files.length)*100}%`;
      try {
        const img = await loadImage(files[i].file);
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        if (format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); }
        else { ctx.clearRect(0,0,canvas.width,canvas.height); }
        ctx.drawImage(img, 0, 0);
        
        const blob = await toBlob(targetMime, format === 'png' ? undefined : quality);
        const name = files[i].file.name.replace(/\.[^.]+$/, '') + '.' + (format === 'jpeg' ? 'jpg' : format);
        downloads.push({blob, name, label: `Download ${name}`});
      } catch(e) {}
    }
    
    showResult('Conversion Complete!', `Processed <span>${downloads.length}</span> images.`, downloads);
  });

  imgCompressBtn.addEventListener('click', async () => {
    if (!files.length) return;
    // Simple compression implementation (uses JPEG and binary search like old app.js)
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Compressing...';
    resultArea.style.display = 'none';
    const downloads = [];
    
    for(let i=0; i<files.length; i++) {
      progressFill.style.width = `${(i/files.length)*100}%`;
      try {
        const img = await loadImage(files[i].file);
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        
        let bestBlob = await toBlob('image/jpeg', 0.9);
        // Basic reduction attempt
        for(let q=0.9; q>=0.1; q-=0.2) {
          const b = await toBlob('image/jpeg', q);
          if (b.size < bestBlob.size) bestBlob = b;
          if (b.size <= targetCompressSize) { bestBlob = b; break; }
        }
        
        const name = files[i].file.name.replace(/\.[^.]+$/, '') + '_compressed.jpg';
        downloads.push({blob: bestBlob, name, label: `Download ${name} (${formatBytes(bestBlob.size)})`});
      } catch(e) {}
    }
    showResult('Compression Complete!', `Processed <span>${downloads.length}</span> images.`, downloads);
  });

  // ============================================
  // PDF Logic
  // ============================================
  
  async function loadPdfLib() {
    if (typeof PDFLib === 'undefined') {
      showToast('PDF-lib is still loading...', 'error');
      throw new Error('PDF-lib not loaded');
    }
    return PDFLib;
  }

  pdfMergeBtn.addEventListener('click', async () => {
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Merging PDFs...';
    const { PDFDocument } = await loadPdfLib();
    const mergedPdf = await PDFDocument.create();
    
    for(let i=0; i<files.length; i++) {
      progressFill.style.width = `${(i/files.length)*100}%`;
      const buf = await files[i].file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(src, src.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }
    const bytes = await mergedPdf.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    showResult('Merge Complete!', `Combined ${files.length} files.`, [{blob, name:'merged.pdf', label:'Download Merged PDF'}]);
  });

  pdfSplitBtn.addEventListener('click', async () => {
    // Basic split: Extract each page as separate PDF
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Splitting PDF...';
    const { PDFDocument } = await loadPdfLib();
    
    const buf = await files[0].file.arrayBuffer();
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const count = src.getPageCount();
    const downloads = [];
    
    for(let i=0; i<count; i++) {
      progressFill.style.width = `${(i/count)*100}%`;
      const newPdf = await PDFDocument.create();
      const [p] = await newPdf.copyPages(src, [i]);
      newPdf.addPage(p);
      const bytes = await newPdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const name = files[0].file.name.replace(/\.pdf$/i, `_page_${i+1}.pdf`);
      downloads.push({blob, name, label:`Download Page ${i+1}`});
    }
    showResult('Split Complete!', `Created ${count} files.`, downloads);
  });

  pdfCompressBtn.addEventListener('click', async () => {
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Compressing PDF...';
    const { PDFDocument } = await loadPdfLib();
    
    const buf = await files[0].file.arrayBuffer();
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(src, src.getPageIndices());
    pages.forEach(p => newPdf.addPage(p));
    
    // Strip metadata
    newPdf.setTitle(''); newPdf.setAuthor(''); newPdf.setProducer('FastConvert');
    
    const bytes = await newPdf.save({ useObjectStreams: true });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const name = files[0].file.name.replace(/\.pdf$/i, '_compressed.pdf');
    showResult('Compress Complete!', `Reduced size from ${formatBytes(files[0].file.size)} to ${formatBytes(blob.size)}.`, [{blob, name, label:'Download Compressed PDF'}]);
  });

  imgToPdfBtn.addEventListener('click', async () => {
    progressWrapper.style.display = 'block';
    progressLabel.textContent = 'Creating PDF...';
    const { PDFDocument } = await loadPdfLib();
    const pdfDoc = await PDFDocument.create();
    
    for(let i=0; i<files.length; i++) {
      if(files[i].category !== 'image') continue;
      progressFill.style.width = `${(i/files.length)*100}%`;
      
      const buf = await files[i].file.arrayBuffer();
      let image;
      if (files[i].file.type === 'image/png') {
        image = await pdfDoc.embedPng(buf);
      } else if (files[i].file.type === 'image/jpeg') {
        image = await pdfDoc.embedJpg(buf);
      } else {
        const img = await loadImage(files[i].file);
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        const pngBlob = await toBlob('image/png');
        image = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
      }
      
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {x:0, y:0, width:image.width, height:image.height});
    }
    
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    showResult('PDF Created!', `Combined ${files.length} images.`, [{blob, name:'images_to_pdf.pdf', label:'Download PDF'}]);
  });

  function showResult(title, metaHTML, downloads) {
    progressWrapper.style.display = 'none';
    resultTitle.textContent = title;
    resultMeta.innerHTML = metaHTML;
    resultDownloads.innerHTML = '';
    
    downloads.forEach(dl => {
      const btn = document.createElement('button');
      btn.className = 'btn-convert';
      btn.style.padding = '8px 16px';
      btn.style.fontSize = '0.9rem';
      btn.innerHTML = dl.label;
      btn.addEventListener('click', () => {
        const url = URL.createObjectURL(dl.blob);
        const a = document.createElement('a');
        a.href = url; a.download = dl.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(()=>URL.revokeObjectURL(url), 1000);
      });
      resultDownloads.appendChild(btn);
    });
    
    resultArea.style.display = 'block';
  }

})();
