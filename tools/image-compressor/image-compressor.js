(function () {
  'use strict';

  // --- State ---
  let currentFile = null;
  let originalFileSize = 0;
  let convertedBlob = null;
  let convertedFileName = '';
  let targetCompressSize = 51200; // default 50KB

  // --- DOM References ---
  const fileInput          = $('#file-input');
  const dropzone           = $('#dropzone');
  const dropzoneDefault    = $('#dropzone-default');
  const dropzoneFileInfo   = $('#dropzone-file-info');
  const fileName           = $('#file-name');
  const fileSize           = $('#file-size');
  const removeFileBtn      = $('#remove-file');
  const imagePreview       = $('#image-preview');
  const previewImg         = $('#preview-img');
  const sizePills          = $$('.size-pill');
  const compressBtn        = $('#compress-btn');
  const progressWrapper    = $('#progress-wrapper');
  const progressFill       = $('#progress-fill');
  const progressLabel      = $('#progress-label');
  const resultArea         = $('#result-area');
  const resultTitle        = $('#result-title');
  const resultFormat       = $('#result-format');
  const resultSize         = $('#result-size');
  const resultStats        = $('#result-stats');
  const statOriginal       = $('#stat-original');
  const statCompressed     = $('#stat-compressed');
  const statSavings        = $('#stat-savings');
  const downloadBtn        = $('#download-btn');

  // Canvas (hidden, used for conversion)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // ============================================
  // File Handling
  // ============================================
  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

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

    const ext = file.name.toLowerCase().split('.').pop();
    const validExts = ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'];
    const typeOk = ACCEPTED_TYPES.includes(file.type) || validExts.includes(ext);

    if (!typeOk) {
      showToast('Unsupported format. Please upload PNG, JPG, WebP, or HEIC.', 'error');
      return;
    }

    originalFileSize = file.size;
    convertedBlob = null;

    dropzone.classList.add('has-file');
    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);

    if (isHeicFile(file)) {
      showToast('Converting HEIC format — please wait…', 'success');
      try {
        const convertedBlobs = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 1,
        });
        const pngBlob = Array.isArray(convertedBlobs) ? convertedBlobs[0] : convertedBlobs;
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

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      imagePreview.style.display = 'flex';
    };
    reader.readAsDataURL(currentFile);

    compressBtn.disabled = false;
    resultArea.style.display = 'none';
    progressWrapper.classList.remove('visible');
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
    compressBtn.disabled = true;
    resultArea.style.display = 'none';
    progressWrapper.classList.remove('visible');
  }

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
  // Target Size Pills
  // ============================================
  sizePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      sizePills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      targetCompressSize = parseInt(pill.dataset.size, 10);
    });
  });

  // ============================================
  // Helper: Load image & Canvas Blob
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
  // Compression Logic
  // ============================================
  async function compressToSize() {
    if (!currentFile) return;

    compressBtn.classList.add('loading');
    compressBtn.disabled = true;
    progressWrapper.classList.add('visible');
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Analyzing image…';
    resultArea.style.display = 'none';

    try {
      const img = await loadImageFromFile(currentFile);

      let bestBlob = null;
      let attempts = 0;
      const maxAttempts = 20;

      const targetMime = 'image/jpeg';
      let currentWidth = img.naturalWidth;
      let currentHeight = img.naturalHeight;

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
          low = mid;
        } else {
          high = mid;
        }
      }

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

          const blob = await canvasToBlob(targetMime, 0.4);
          const progress = Math.min(70 + ((0.9 - scale) / 0.85) * 25, 95);
          progressFill.style.width = progress + '%';

          if (blob.size <= targetCompressSize) {
            bestBlob = blob;
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

        resultTitle.textContent = 'Compression Complete!';
        resultFormat.textContent = 'JPG';
        resultSize.textContent = formatBytes(bestBlob.size);

        statOriginal.textContent = formatBytes(originalFileSize);
        statCompressed.textContent = formatBytes(bestBlob.size);
        const savedPct = ((1 - bestBlob.size / originalFileSize) * 100).toFixed(1);
        statSavings.textContent = savedPct + '%';

        resultArea.style.display = 'block';
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

})();
