(function () {
  'use strict';

  /* ============================================
     FastConvert — Remove Background Tool
     Uses @imgly/background-removal (client-side)
     ============================================ */

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
  let selectedBg = 'transparent';

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

  function setProgress(pct, label) {
    progressFill.style.width = pct + '%';
    if (label) progressLabel.textContent = label;
  }

  /* ------------------------------------------
     HEIC decoding
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
    var ext = file.name.split('.').pop().toLowerCase();
    if (!file.type.startsWith('image/') && ['heic', 'heif'].indexOf(ext) === -1) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    if (file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic') {
      file = await decodeHeic(file);
      if (!file) return;
    }

    currentFile = file;

    // Show file info
    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);

    // Show preview
    var reader = new FileReader();
    reader.onload = function (e) {
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

    removeBgBtn.disabled = true;
    progressWrapper.style.display = 'block';
    resultPreviewItem.style.display = 'none';
    resultArea.style.display = 'none';
    resultBlob = null;

    setProgress(5, 'Loading AI model — this may take a moment on first use…');

    try {
      // Dynamically import the library (first load downloads ~30 MB model, cached after)
      var mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');

      setProgress(25, 'Analyzing image with AI…');

      var config = {
        progress: function (key, current, total) {
          if (key === 'compute:inference') {
            var pct = Math.round(25 + (current / total) * 60);
            setProgress(pct, 'Removing background…');
          }
        }
      };

      var outputBlob = await mod.removeBackground(currentFile, config);

      setProgress(90, 'Applying background color…');

      // Apply selected background color
      if (selectedBg !== 'transparent') {
        outputBlob = await compositeOnColor(outputBlob, selectedBg);
      }

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
      setTimeout(function () {
        progressWrapper.style.display = 'none';
        resultArea.style.display = 'block';
        removeBgBtn.disabled = false;
      }, 500);

      showToast('Background removed successfully!');

    } catch (err) {
      console.error('Background removal failed:', err);
      progressWrapper.style.display = 'none';
      removeBgBtn.disabled = false;
      showToast('Failed to remove background. Try a smaller image.', 'error');
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
    if (!currentFile) return;
    try {
      progressWrapper.style.display = 'block';
      setProgress(50, 'Changing background…');

      var mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');

      // Re-run removal to get fresh transparent output
      var outputBlob = await mod.removeBackground(currentFile);

      if (selectedBg !== 'transparent') {
        outputBlob = await compositeOnColor(outputBlob, selectedBg);
      }

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
      resultArea.style.display = 'block';
      showToast('Background updated!');
    } catch (err) {
      progressWrapper.style.display = 'none';
      showToast('Failed to update background.', 'error');
    }
  }

  /* ------------------------------------------
     Remove / reset
     ------------------------------------------ */
  removeFileBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    currentFile = null;
    resultBlob = null;
    fileInput.value = '';

    dropzoneDefault.style.display = 'flex';
    dropzoneFileInfo.style.display = 'none';
    previewContainer.style.display = 'none';
    bgControls.style.display = 'none';
    progressWrapper.style.display = 'none';
    resultArea.style.display = 'none';
    resultPreviewItem.style.display = 'none';
    previewImg.src = '';
    resultImg.src = '';
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
