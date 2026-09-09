/**
 * FastConvert — Remove Image Background
 * ======================================
 * AI-powered background removal running 100% client-side in the browser.
 * Zero uploads, complete privacy.
 *
 * Uses Transformers.js (briaai/RMBG-1.4 with automatic fallback to Xenova/modnet).
 * The AI pipeline is loaded lazily on-demand so page load and file uploads
 * are completely instant and never blocked.
 */

(function () {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────── */
  let currentFile = null;
  let transparentBlob = null;
  let downloadBlob = null;
  let downloadFileName = '';
  let segmentator = null;
  let segmentatorPromise = null;
  let transformersModule = null;

  /* ─── DOM References ────────────────────────────────────────── */
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const dropzoneDefault = document.getElementById('dropzone-default');
  const dropzoneFileInfo = document.getElementById('dropzone-file-info');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const removeFileBtn = document.getElementById('remove-file');
  const removeBgControls = document.getElementById('remove-bg-controls');
  const removeBgBtn = document.getElementById('remove-bg-btn');
  const progressWrapper = document.getElementById('progress-wrapper');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');
  const resultArea = document.getElementById('result-area');
  const resultSizeEl = document.getElementById('result-size');
  const canvasBefore = document.getElementById('canvas-before');
  const canvasAfter = document.getElementById('canvas-after');
  const bgColorInput = document.getElementById('bg-color-input');
  const applyBgColorBtn = document.getElementById('apply-bg-color-btn');
  const resetTransparentBtn = document.getElementById('reset-transparent-btn');
  const downloadBtn = document.getElementById('download-btn');
  const toastEl = document.getElementById('toast');

  /* ─── Toast Notifications ───────────────────────────────────── */
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.className = 'toast';
    toastEl.classList.add(type, 'visible');
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 3500);
  }

  /* ─── Helpers ────────────────────────────────────────────────── */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  const ACCEPTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']);
  const ACCEPTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

  function isValidImageFile(file) {
    if (!file) return false;
    const ext = (file.name || '').toLowerCase().split('.').pop();
    return ACCEPTED_MIME.has(file.type) || ACCEPTED_EXTENSIONS.has(ext) || (file.type && file.type.startsWith('image/'));
  }

  function setProgress(pct, label) {
    if (progressFill) progressFill.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (progressLabel) progressLabel.textContent = label;
  }

  function setCheckerboard(on) {
    if (!canvasAfter) return;
    if (on) {
      canvasAfter.classList.add('canvas-checkerboard');
      canvasAfter.style.backgroundColor = '';
    } else {
      canvasAfter.classList.remove('canvas-checkerboard');
    }
  }

  function loadImage(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fileOrBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image file.'));
      };
      img.src = url;
    });
  }

  function renderToPreviewCanvas(canvas, img, maxDim = 320) {
    if (!canvas || !img) return;
    const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight, 1);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  /* ─── File Handling ─────────────────────────────────────────── */
  async function handleFile(file) {
    if (!file) return;

    if (!isValidImageFile(file)) {
      showToast('Unsupported format. Please upload PNG, JPG, WebP, or HEIC.', 'error');
      return;
    }

    // HEIC/HEIF decoding if needed
    const ext = (file.name || '').toLowerCase().split('.').pop();
    if (ext === 'heic' || ext === 'heif' || file.type === 'image/heic') {
      if (typeof window.heic2any === 'function') {
        showToast('Converting HEIC image...', 'success');
        try {
          const converted = await window.heic2any({ blob: file, toType: 'image/png', quality: 1 });
          const blob = Array.isArray(converted) ? converted[0] : converted;
          file = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.png'), { type: 'image/png' });
        } catch (e) {
          console.warn('HEIC decode failed:', e);
          showToast('Could not decode HEIC image. Please upload a PNG or JPG.', 'error');
          return;
        }
      }
    }

    currentFile = file;
    transparentBlob = null;
    downloadBlob = null;

    // Update Dropzone UI
    if (dropzone) dropzone.classList.add('has-file');
    if (dropzoneDefault) dropzoneDefault.style.display = 'none';
    if (dropzoneFileInfo) dropzoneFileInfo.style.display = 'flex';
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);

    // Show controls, hide previous result & progress
    if (removeBgControls) removeBgControls.style.display = 'flex';
    if (resultArea) resultArea.style.display = 'none';
    if (progressWrapper) progressWrapper.classList.remove('visible');

    // Draw original image preview immediately
    try {
      const img = await loadImage(file);
      renderToPreviewCanvas(canvasBefore, img);
    } catch (err) {
      console.warn('Preview rendering error:', err);
    }

    showToast(`"${file.name}" loaded! Ready to remove background.`, 'success');
  }

  function resetTool() {
    currentFile = null;
    transparentBlob = null;
    downloadBlob = null;
    downloadFileName = '';

    if (fileInput) fileInput.value = '';
    if (dropzone) dropzone.classList.remove('has-file', 'drag-over');
    if (dropzoneDefault) dropzoneDefault.style.display = '';
    if (dropzoneFileInfo) dropzoneFileInfo.style.display = 'none';
    if (fileNameEl) fileNameEl.textContent = '';
    if (fileSizeEl) fileSizeEl.textContent = '';
    if (removeBgControls) removeBgControls.style.display = 'none';
    if (resultArea) resultArea.style.display = 'none';
    if (progressWrapper) progressWrapper.classList.remove('visible');

    [canvasBefore, canvasAfter].forEach(c => {
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      c.width = 0;
      c.height = 0;
    });

    setCheckerboard(true);
  }

  /* ─── Event Listeners: Dropzone & Upload ──────────────────────── */
  if (dropzone && fileInput) {
    // Click dropzone to open file dialog
    dropzone.addEventListener('click', (e) => {
      if (e.target.closest('#remove-file')) return;
      fileInput.click();
    });

    // Keyboard accessibility
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length) {
        handleFile(fileInput.files[0]);
      }
    });

    // Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('drag-over');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        handleFile(dt.files[0]);
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetTool();
    });
  }

  // Paste image from clipboard support (Ctrl+V)
  window.addEventListener('paste', (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
          break;
        }
      }
    }
  });

  /* ─── Download Helper ────────────────────────────────────────── */
  let currentDownloadUrl = null;
  function updateDownloadButton(blob, filename) {
    if (!downloadBtn) return;
    if (currentDownloadUrl) URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl = URL.createObjectURL(blob);
    downloadBtn.href = currentDownloadUrl;
    downloadBtn.download = filename;
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', (e) => {
      if (!downloadBlob) {
        e.preventDefault();
        return;
      }
      showToast('Download started!', 'success');
    });
  }

  /* ─── Lazy AI Pipeline Loader ────────────────────────────────── */
  async function getSegmentationPipeline() {
    if (segmentator) return segmentator;
    if (segmentatorPromise) return segmentatorPromise;

    segmentatorPromise = (async () => {
      setProgress(10, 'Loading AI engine...');

      // Dynamic import of Transformers.js v3 from CDN
      if (!transformersModule) {
        transformersModule = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0');
      }

      const { pipeline, env } = transformersModule;
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Progress callback for model download
      const onProgress = (data) => {
        if (data && data.status === 'progress') {
          const pct = Math.round(data.progress || 0);
          setProgress(15 + Math.round(pct * 0.65), `Downloading AI model... ${pct}%`);
        } else if (data && data.status === 'ready') {
          setProgress(82, 'Model loaded!');
        }
      };

      try {
        setProgress(15, 'Loading RMBG-1.4 background removal model (cached after first use)...');
        segmentator = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
          progress_callback: onProgress
        });
        return segmentator;
      } catch (err1) {
        console.warn('Primary RMBG-1.4 model failed, falling back to Xenova/modnet:', err1);
        setProgress(20, 'Loading lightweight AI model (Xenova/modnet)...');
        segmentator = await pipeline('image-segmentation', 'Xenova/modnet', {
          progress_callback: onProgress
        });
        return segmentator;
      }
    })();

    return segmentatorPromise;
  }

  /* ─── Core: Remove Background ───────────────────────────────── */
  async function runRemoveBackground() {
    if (!currentFile) {
      showToast('Please select an image first.', 'error');
      return;
    }

    if (removeBgBtn) {
      removeBgBtn.classList.add('loading');
      removeBgBtn.disabled = true;
    }
    if (progressWrapper) progressWrapper.classList.add('visible');
    setProgress(5, 'Starting background removal...');
    if (resultArea) resultArea.style.display = 'none';

    try {
      // 1. Ensure original preview is rendered
      const originalImage = await loadImage(currentFile);
      renderToPreviewCanvas(canvasBefore, originalImage);

      // 2. Load AI Pipeline
      const pipe = await getSegmentationPipeline();

      setProgress(82, 'Analyzing photo and detecting subject...');

      // 3. Load image into RawImage
      const { RawImage } = transformersModule;
      const rawInput = await RawImage.fromBlob(currentFile);

      // 4. Run AI Segmentation
      setProgress(88, 'Removing background...');
      const segmentationResult = await pipe(rawInput);

      setProgress(94, 'Applying transparency mask...');

      // 5. Extract and composite mask
      const maskResult = Array.isArray(segmentationResult) ? segmentationResult[0] : segmentationResult;
      let mask = maskResult.mask || maskResult;
      if (!mask) throw new Error('Segmentation produced no mask output.');

      const origW = rawInput.width;
      const origH = rawInput.height;

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = origW;
      outputCanvas.height = origH;
      const outCtx = outputCanvas.getContext('2d');

      if (mask.channels === 4) {
        // Model returned an already-cutout RGBA image
        const maskCanvas = mask.toCanvas();
        outCtx.drawImage(maskCanvas, 0, 0, origW, origH);
      } else {
        // 1-channel alpha mask: composite with original image
        if (mask.width !== origW || mask.height !== origH) {
          mask = await mask.resize(origW, origH);
        }

        // Draw original pixels
        outCtx.drawImage(rawInput.toCanvas(), 0, 0, origW, origH);
        const imgData = outCtx.getImageData(0, 0, origW, origH);
        const pixels = imgData.data;
        const maskPixels = mask.data;

        // Overwrite alpha channel with mask data
        for (let i = 0; i < maskPixels.length; i++) {
          pixels[i * 4 + 3] = maskPixels[i];
        }
        outCtx.putImageData(imgData, 0, 0);
      }

      setProgress(98, 'Finalizing output...');

      // 6. Export to PNG Blob
      const resultBlob = await new Promise((resolve, reject) => {
        outputCanvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas export to PNG failed.'));
        }, 'image/png', 1.0);
      });

      transparentBlob = resultBlob;
      downloadBlob = resultBlob;
      const baseName = (currentFile.name || 'image').replace(/\.[^.]+$/, '');
      downloadFileName = `${baseName}_no-bg.png`;

      // 7. Render "After" preview
      setCheckerboard(true);
      const afterImage = await loadImage(resultBlob);
      renderToPreviewCanvas(canvasAfter, afterImage);

      // 8. Update UI & Download link
      if (resultSizeEl) resultSizeEl.textContent = formatBytes(resultBlob.size);
      updateDownloadButton(resultBlob, downloadFileName);

      setProgress(100, 'Done!');
      if (resultArea) resultArea.style.display = 'block';
      showToast('Background removed successfully!', 'success');

      resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      console.error('[FastConvert · RemoveBG] Error:', err);
      let errMsg = 'Background removal failed. Please try again.';
      const msgLower = (err.message || '').toLowerCase();
      if (msgLower.includes('fetch') || msgLower.includes('network')) {
        errMsg = 'Network error: could not load the AI model. Check your internet connection.';
      }
      showToast(errMsg, 'error');
    } finally {
      if (removeBgBtn) {
        removeBgBtn.classList.remove('loading');
        removeBgBtn.disabled = false;
      }
      setTimeout(() => {
        if (progressWrapper) progressWrapper.classList.remove('visible');
      }, 1800);
    }
  }

  if (removeBgBtn) {
    removeBgBtn.addEventListener('click', runRemoveBackground);
  }

  /* ─── Background Colour Customization ───────────────────────── */
  function compositeOnSolidColor(colorHex) {
    return new Promise(async (resolve, reject) => {
      try {
        if (!transparentBlob) return reject(new Error('No transparent image available'));
        const img = await loadImage(transparentBlob);
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d');

        // Fill solid background
        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, cv.width, cv.height);

        // Draw transparent cutout on top
        ctx.drawImage(img, 0, 0);

        cv.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png', 1.0);
      } catch (e) {
        reject(e);
      }
    });
  }

  if (applyBgColorBtn && bgColorInput) {
    applyBgColorBtn.addEventListener('click', async () => {
      if (!transparentBlob) return;
      const color = bgColorInput.value || '#ffffff';
      applyBgColorBtn.disabled = true;
      applyBgColorBtn.textContent = 'Applying...';

      try {
        const coloredBlob = await compositeOnSolidColor(color);
        downloadBlob = coloredBlob;
        setCheckerboard(false);
        if (canvasAfter) canvasAfter.style.backgroundColor = color;

        const coloredImg = await loadImage(coloredBlob);
        renderToPreviewCanvas(canvasAfter, coloredImg);

        if (resultSizeEl) resultSizeEl.textContent = formatBytes(coloredBlob.size);
        const colorName = downloadFileName.replace('_no-bg.png', '_bg-color.png');
        updateDownloadButton(coloredBlob, colorName);
        showToast('Background color applied!', 'success');
      } catch (err) {
        console.error('[RemoveBG] Color composite error:', err);
        showToast('Failed to apply background color.', 'error');
      } finally {
        applyBgColorBtn.disabled = false;
        applyBgColorBtn.textContent = 'Apply Color';
      }
    });
  }

  if (resetTransparentBtn) {
    resetTransparentBtn.addEventListener('click', async () => {
      if (!transparentBlob) return;
      downloadBlob = transparentBlob;
      setCheckerboard(true);

      const transImg = await loadImage(transparentBlob);
      renderToPreviewCanvas(canvasAfter, transImg);

      if (resultSizeEl) resultSizeEl.textContent = formatBytes(transparentBlob.size);
      updateDownloadButton(transparentBlob, downloadFileName);
      showToast('Restored transparent background.', 'success');
    });
  }

})();
