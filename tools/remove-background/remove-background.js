(function () {
  'use strict';

  /* ============================================
     FastConvert — Remove Background Tool
     Server-side removal (rembg / isnet-general-use)
     + manual touch-up brush editor (erase / restore)
     ============================================ */

  // Point this at your deployed server (see server/README.md).
 const API_ENDPOINT =
  'https://fastconvert-backend-api.onrender.com/api/remove-background';

  const fileInput      = document.getElementById('file-input');
  const dropzone       = document.getElementById('dropzone');
  const dropzoneDefault = document.getElementById('dropzone-default');
  const dropzoneFileInfo = document.getElementById('dropzone-file-info');
  const fileNameEl     = document.getElementById('file-name');
  const fileSizeEl     = document.getElementById('file-size');
  const removeFileBtn  = document.getElementById('remove-file');
  const previewContainer = document.getElementById('image-preview');
  const previewImg     = document.getElementById('preview-img');
  const resultPreviewItem = document.getElementById('result-preview-item');
  const resultImg      = document.getElementById('result-img');
  const bgControls     = document.getElementById('bg-controls');
  const removeBgBtn    = document.getElementById('remove-bg-btn');
  const progressWrapper = document.getElementById('progress-wrapper');
  const progressFill   = document.getElementById('progress-fill');
  const progressLabel  = document.getElementById('progress-label');
  const progressEta    = document.getElementById('progress-eta');
  const resultArea     = document.getElementById('result-area');
  const downloadBtn    = document.getElementById('download-btn');
  const resultFormat   = document.getElementById('result-format');
  const resultSizeEl   = document.getElementById('result-size');
  const statOriginal   = document.getElementById('stat-original');
  const statOutput     = document.getElementById('stat-output');
  const bgOptions      = document.querySelectorAll('.bg-option');
  const customColorInput = document.getElementById('custom-bg-color');
  const customBgSwatch = document.getElementById('custom-bg-swatch');

  let currentFile = null;
  let resultBlob = null;
  let transparentResultBlob = null;
  let selectedBg = 'transparent';
  let operationId = 0;
  let completionTimer = null;
  let progressEstimateStartedAt = 0;
  let progressEstimateStartedAtPct = 0;

  const DEFAULT_PROGRESS_LABEL = 'Uploading image to our server…';

  /* ------------------------------------------
     Helpers
     ------------------------------------------ */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function showToast(message, type) {
    type = type || 'success';
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type, 'visible');
    setTimeout(function () { toast.classList.remove('visible'); }, 3500);
  }

  function formatRemaining(seconds) {
    if (seconds < 60) return Math.max(1, Math.ceil(seconds)) + ' sec';
    var minutes = Math.floor(seconds / 60);
    var remainingSeconds = Math.ceil(seconds % 60);
    return minutes + ' min' + (remainingSeconds ? ' ' + remainingSeconds + ' sec' : '');
  }

  function resetProgressEstimate() {
    progressEstimateStartedAt = 0;
    progressEstimateStartedAtPct = 0;
    progressEta.textContent = 'Estimating remaining time…';
  }

  function setProgressEstimate(message) {
    progressEta.textContent = message;
  }

  function setProgress(pct, label, estimateFromPct) {
    progressFill.style.width = pct + '%';
    if (label) progressLabel.textContent = label;

    if (estimateFromPct && pct > estimateFromPct) {
      if (!progressEstimateStartedAt) {
        progressEstimateStartedAt = performance.now();
        progressEstimateStartedAtPct = pct;
      }

      var elapsedSeconds = (performance.now() - progressEstimateStartedAt) / 1000;
      var completedPct = pct - progressEstimateStartedAtPct;
      var remainingPct = 100 - pct;
      if (completedPct > 0 && elapsedSeconds > 0) {
        progressEta.textContent = 'About ' + formatRemaining(elapsedSeconds * remainingPct / completedPct) + ' remaining';
      }
    }
  }

  /* ------------------------------------------
     Server call
     ------------------------------------------
     Uses XMLHttpRequest (not fetch) so we get real upload-progress
     events. The server doesn't stream inference progress back, so once
     the upload finishes we simulate a gentle ramp up to ~90% and jump
     to 100% when the response actually arrives — this keeps the bar
     moving instead of freezing while the model runs server-side.
  */
  function removeBackgroundOnServer(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_ENDPOINT, true);
      xhr.responseType = 'blob';

      var simTimer = null;
      var simPct = 0;

      function stopSim() {
        if (simTimer) {
          clearInterval(simTimer);
          simTimer = null;
        }
      }

      xhr.upload.onprogress = function (e) {
        if (!e.lengthComputable) return;
        var uploadPct = (e.loaded / e.total) * 30; // uploading = first 30% of the bar
        onProgress(uploadPct, 'Uploading image to our server…');
      };

      xhr.upload.onload = function () {
        simPct = 30;
        onProgress(simPct, 'Removing background on the server…');
        simTimer = setInterval(function () {
          simPct = Math.min(simPct + 2 + Math.random() * 3, 90);
          onProgress(simPct, 'Removing background on the server…');
        }, 350);
      };

      xhr.onload = function () {
        stopSim();
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100, 'Done!');
          resolve(xhr.response);
          return;
        }

        var reader = new FileReader();
        reader.onload = function () {
          var message = 'Background removal failed on this image.';
          try {
            var parsed = JSON.parse(reader.result);
            if (parsed && parsed.detail) message = parsed.detail;
          } catch (e) { /* not JSON, use default message */ }
          reject(new Error(message));
        };
        reader.onerror = function () {
          reject(new Error('Background removal failed on this image.'));
        };
        reader.readAsText(xhr.response);
      };

      xhr.onerror = function () {
        stopSim();
        reject(new Error('The background removal server stopped while processing. It may need more memory; please try again shortly.'));
      };

      xhr.ontimeout = function () {
        stopSim();
        reject(new Error('The server took too long to respond. Please try again.'));
      };

      xhr.timeout = 120000; // 2 min — large images / cold-started servers can be slow

      var formData = new FormData();
      formData.append('file', file, file.name);
      xhr.send(formData);
    });
  }

  /* ------------------------------------------
     HEIC decoding (client-side, so the browser can preview it —
     the server also accepts HEIC directly if you skip this)
     ------------------------------------------ */
  async function decodeHeic(file) {
    showToast('Decoding HEIC…', 'success');
    try {
      var blob = await heic2any({ blob: file, toType: 'image/png', quality: 1 });
      var pngBlob = Array.isArray(blob) ? blob[0] : blob;
      return new File([pngBlob], file.name.replace(/\.(heic|heif)$/i, '.png'), { type: 'image/png' });
    } catch (e) {
      showToast('Failed to decode HEIC.', 'error');
      return null;
    }
  }

  /* ------------------------------------------
     Main: load image
     ------------------------------------------ */
  async function handleFile(file) {
    var fileOperationId = ++operationId;
    var ext = file.name.split('.').pop().toLowerCase();
    if (!file.type.startsWith('image/') && ['heic', 'heif'].indexOf(ext) === -1) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    if (file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic') {
      file = await decodeHeic(file);
      if (!file || fileOperationId !== operationId) return;
    }

    currentFile = file;
    originalPixelsImg = null; // invalidate cached original for the touch-up "restore" brush

    // Show file info
    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);

    // Show preview
    var reader = new FileReader();
    reader.onload = function (e) {
      if (fileOperationId !== operationId || currentFile !== file) return;
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
      resultPreviewItem.style.display = 'none';
      resultArea.style.display = 'none';
      bgControls.style.display = 'flex';
      removeBgBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------
     Background removal
     ------------------------------------------ */
  removeBgBtn.addEventListener('click', async function () {
    if (!currentFile) return;
    var currentOperationId = ++operationId;

    removeBgBtn.disabled = true;
    removeBgBtn.classList.add('loading');
    progressWrapper.style.display = 'block';
    resultPreviewItem.style.display = 'none';
    resultArea.style.display = 'none';
    resultBlob = null;
    transparentResultBlob = null;
    resetProgressEstimate();

    setProgress(1, DEFAULT_PROGRESS_LABEL);
    setProgressEstimate('Estimated 5–20 sec, depending on image size');

    try {
      var outputBlob = await removeBackgroundOnServer(currentFile, function (pct, label) {
        setProgress(Math.round(pct), label, 30);
      });
      if (currentOperationId !== operationId) return;
      transparentResultBlob = outputBlob;

      setProgress(95, 'Applying background color…');

      // Apply selected background color
      if (selectedBg !== 'transparent') {
        outputBlob = await compositeOnColor(outputBlob, selectedBg);
      }
      if (currentOperationId !== operationId) return;

      resultBlob = outputBlob;

      // Show result
      var resultUrl = URL.createObjectURL(outputBlob);
      resultImg.src = resultUrl;
      resultPreviewItem.style.display = 'block';

      // Download setup
      var baseName = currentFile.name.replace(/\.[^.]+$/, '');
      downloadBtn.href = resultUrl;
      downloadBtn.download = baseName + '_no_bg.png';

      // Stats
      resultFormat.textContent = 'PNG';
      resultSizeEl.textContent = formatBytes(outputBlob.size);
      statOriginal.textContent = formatBytes(currentFile.size);
      statOutput.textContent = formatBytes(outputBlob.size);

      setProgress(100, 'Done!');
      progressEta.textContent = 'Complete';
      completionTimer = setTimeout(function () {
        if (currentOperationId !== operationId) return;
        progressWrapper.style.display = 'none';
        resultArea.style.display = 'block';
        removeBgBtn.disabled = false;
        removeBgBtn.classList.remove('loading');
      }, 500);

      showToast('Background removed successfully!');

    } catch (err) {
      console.error('Background removal failed:', err);
      progressWrapper.style.display = 'none';
      resetProgressEstimate();
      removeBgBtn.disabled = false;
      removeBgBtn.classList.remove('loading');
      progressLabel.textContent = 'Processing failed';
      progressEta.textContent = err.message || 'Something went wrong. Please try again.';
      showToast(err.message || 'Something went wrong. Please try again.', 'error');
    }
  });

  /* ------------------------------------------
     Composite transparent blob on solid color
     ------------------------------------------ */
  function compositeOnColor(transparentBlob, color) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw cutout on top
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(function (blob) {
          resolve(blob);
        }, 'image/png');
      };
      img.src = URL.createObjectURL(transparentBlob);
    });
  }

  /* ------------------------------------------
     Background color picker
     ------------------------------------------ */
  bgOptions.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var bg = btn.dataset.bg;

      if (bg === 'transparent' || bg.charAt(0) === '#') {
        selectedBg = bg;
        bgOptions.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // Re-process if result already exists
        if (resultBlob && currentFile) {
          reprocessWithBg();
        }
      }
    });
  });

  // Custom color picker
  if (customColorInput) {
    customColorInput.addEventListener('input', function () {
      customBgSwatch.style.background = customColorInput.value;
      selectedBg = customColorInput.value;
      bgOptions.forEach(function (b) { b.classList.remove('active'); });
      document.querySelector('.bg-custom').classList.add('active');

      if (resultBlob && currentFile) {
        reprocessWithBg();
      }
    });
    // Also allow clicking the custom swatch to open picker
    document.querySelector('.bg-custom').addEventListener('click', function () {
      customColorInput.click();
    });
  }

  async function reprocessWithBg() {
    if (!currentFile || !transparentResultBlob) return;
    var currentOperationId = operationId;
    try {
      progressWrapper.style.display = 'block';
      removeBgBtn.classList.add('loading');
      resetProgressEstimate();
      setProgress(60, 'Applying background color…');
      setProgressEstimate('Usually takes less than 2 sec');

      var outputBlob = transparentResultBlob;

      if (selectedBg !== 'transparent') {
        outputBlob = await compositeOnColor(outputBlob, selectedBg);
      }
      if (currentOperationId !== operationId) return;

      resultBlob = outputBlob;

      var resultUrl = URL.createObjectURL(outputBlob);
      resultImg.src = resultUrl;
      resultPreviewItem.style.display = 'block';

      var baseName = currentFile.name.replace(/\.[^.]+$/, '');
      downloadBtn.href = resultUrl;
      downloadBtn.download = baseName + '_no_bg.png';
      resultSizeEl.textContent = formatBytes(outputBlob.size);
      statOutput.textContent = formatBytes(outputBlob.size);

      progressWrapper.style.display = 'none';
      resetProgressEstimate();
      removeBgBtn.classList.remove('loading');
      resultArea.style.display = 'block';
      showToast('Background updated!');
    } catch (err) {
      progressWrapper.style.display = 'none';
      removeBgBtn.classList.remove('loading');
      showToast('Failed to update background.', 'error');
    }
  }

  /* ------------------------------------------
     Touch-up editor — manual brush erase / restore
     ------------------------------------------
     Erase: punches transparent holes wherever the AI left background in.
     Restore: paints the original photo's pixels back in, for spots the
     AI mistakenly cut out of the subject.
     Both edit `transparentResultBlob` directly (the master transparent
     cutout); the on-screen result then goes through the normal
     background-color compositing step, same as the color picker does.
  */
  const touchupBtn      = document.getElementById('touchup-btn');
  const touchupModal    = document.getElementById('touchup-modal');
  const touchupCloseBtn = document.getElementById('touchup-close-btn');
  const touchupCanvas   = document.getElementById('touchup-canvas');
  const modeEraseBtn    = document.getElementById('mode-erase-btn');
  const modeRestoreBtn  = document.getElementById('mode-restore-btn');
  const brushSizeInput  = document.getElementById('brush-size');
  const touchupUndoBtn  = document.getElementById('touchup-undo-btn');
  const touchupResetBtn = document.getElementById('touchup-reset-btn');
  const touchupDoneBtn  = document.getElementById('touchup-done-btn');

  let editCtx = null;
  let brushMode = 'erase';
  let brushSize = brushSizeInput ? parseInt(brushSizeInput.value, 10) : 32;
  let isPainting = false;
  let undoStack = [];
  let originalPixelsImg = null; // cached full-res <img> of the ORIGINAL upload, for Restore
  const MAX_UNDO = 20;

  function loadOriginalPixels() {
    return new Promise(function (resolve, reject) {
      if (originalPixelsImg) return resolve(originalPixelsImg);
      var img = new Image();
      img.onload = function () {
        originalPixelsImg = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(currentFile);
    });
  }

  function openTouchUp() {
    if (!touchupModal || !transparentResultBlob || !currentFile) return;

    var cutoutImg = new Image();
    cutoutImg.onload = function () {
      loadOriginalPixels().then(function () {
        touchupCanvas.width = cutoutImg.naturalWidth;
        touchupCanvas.height = cutoutImg.naturalHeight;
        editCtx = touchupCanvas.getContext('2d');
        editCtx.drawImage(cutoutImg, 0, 0);
        undoStack = [];
        pushUndoSnapshot();
        setBrushMode('erase');
        touchupModal.style.display = 'flex';
      }).catch(function () {
        showToast('Could not load the original image for touch-up.', 'error');
      });
    };
    cutoutImg.src = URL.createObjectURL(transparentResultBlob);
  }

  function closeTouchUp() {
    touchupModal.style.display = 'none';
  }

  function pushUndoSnapshot() {
    if (!editCtx) return;
    var snap = editCtx.getImageData(0, 0, touchupCanvas.width, touchupCanvas.height);
    undoStack.push(snap);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function setBrushMode(mode) {
    brushMode = mode;
    if (modeEraseBtn) modeEraseBtn.classList.toggle('active', mode === 'erase');
    if (modeRestoreBtn) modeRestoreBtn.classList.toggle('active', mode === 'restore');
  }

  function canvasPointFromEvent(evt) {
    var rect = touchupCanvas.getBoundingClientRect();
    var scaleX = touchupCanvas.width / rect.width;
    var scaleY = touchupCanvas.height / rect.height;
    var clientX = evt.touches && evt.touches.length ? evt.touches[0].clientX : evt.clientX;
    var clientY = evt.touches && evt.touches.length ? evt.touches[0].clientY : evt.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function paintAt(point) {
    if (!editCtx) return;
    var radius = brushSize / 2;

    if (brushMode === 'erase') {
      editCtx.save();
      editCtx.globalCompositeOperation = 'destination-out';
      editCtx.beginPath();
      editCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      editCtx.fill();
      editCtx.restore();
    } else {
      editCtx.save();
      editCtx.beginPath();
      editCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      editCtx.clip();
      editCtx.globalCompositeOperation = 'source-over';
      editCtx.drawImage(originalPixelsImg, 0, 0, touchupCanvas.width, touchupCanvas.height);
      editCtx.restore();
    }
  }

  function startPaint(evt) {
    if (!editCtx) return;
    evt.preventDefault();
    isPainting = true;
    pushUndoSnapshot();
    paintAt(canvasPointFromEvent(evt));
  }
  function movePaint(evt) {
    if (!isPainting) return;
    evt.preventDefault();
    paintAt(canvasPointFromEvent(evt));
  }
  function endPaint() {
    isPainting = false;
  }

  if (touchupCanvas) {
    touchupCanvas.addEventListener('mousedown', startPaint);
    touchupCanvas.addEventListener('mousemove', movePaint);
    window.addEventListener('mouseup', endPaint);
    touchupCanvas.addEventListener('touchstart', startPaint, { passive: false });
    touchupCanvas.addEventListener('touchmove', movePaint, { passive: false });
    touchupCanvas.addEventListener('touchend', endPaint);
  }

  if (modeEraseBtn) modeEraseBtn.addEventListener('click', function () { setBrushMode('erase'); });
  if (modeRestoreBtn) modeRestoreBtn.addEventListener('click', function () { setBrushMode('restore'); });

  if (brushSizeInput) {
    brushSizeInput.addEventListener('input', function () {
      brushSize = parseInt(brushSizeInput.value, 10);
    });
  }

  if (touchupUndoBtn) {
    touchupUndoBtn.addEventListener('click', function () {
      if (undoStack.length <= 1) return;
      undoStack.pop(); // discard the current state
      var prev = undoStack[undoStack.length - 1];
      editCtx.putImageData(prev, 0, 0);
    });
  }

  if (touchupResetBtn) {
    touchupResetBtn.addEventListener('click', function () {
      if (!undoStack.length) return;
      var first = undoStack[0];
      editCtx.putImageData(first, 0, 0);
      undoStack = [first];
    });
  }

  if (touchupCloseBtn) touchupCloseBtn.addEventListener('click', closeTouchUp);
  if (touchupBtn) touchupBtn.addEventListener('click', openTouchUp);

  if (touchupDoneBtn) {
    touchupDoneBtn.addEventListener('click', function () {
      if (!touchupCanvas) return;
      touchupCanvas.toBlob(function (blob) {
        transparentResultBlob = blob;
        closeTouchUp();
        reprocessWithBg();
        showToast('Touch-up applied!');
      }, 'image/png');
    });
  }

  /* ------------------------------------------
     Remove / reset
     ------------------------------------------ */
  removeFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    operationId += 1;
    if (completionTimer) {
      clearTimeout(completionTimer);
      completionTimer = null;
    }
    currentFile = null;
    resultBlob = null;
    transparentResultBlob = null;
    originalPixelsImg = null;
    undoStack = [];
    fileInput.value = '';

    dropzoneDefault.style.display = 'flex';
    dropzoneFileInfo.style.display = 'none';
    previewContainer.style.display = 'none';
    bgControls.style.display = 'none';
    progressWrapper.style.display = 'none';
    progressFill.style.width = '0%';
    progressLabel.textContent = DEFAULT_PROGRESS_LABEL;
    progressEta.textContent = '';
    resultArea.style.display = 'none';
    resultPreviewItem.style.display = 'none';
    previewImg.src = '';
    resultImg.src = '';
    selectedBg = 'transparent';
    bgOptions.forEach(function (option) { option.classList.remove('active'); });
    document.querySelector('.bg-option[data-bg="transparent"]').classList.add('active');
    removeBgBtn.disabled = false;
    removeBgBtn.classList.remove('loading');
    if (touchupModal) touchupModal.style.display = 'none';
  });

  /* ------------------------------------------
     Dropzone click / drag
     ------------------------------------------ */
  dropzone.addEventListener('click', function (e) {
    if (e.target.closest('#remove-file')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (ev) {
      ev.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (ev) {
      ev.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

})();
