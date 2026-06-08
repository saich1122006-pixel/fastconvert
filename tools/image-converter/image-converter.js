(function () {
  'use strict';

  // --- State ---
  let currentFile = null;
  let convertedBlob = null;
  let convertedFileName = '';

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
  const formatSelect       = $('#format-select');
  const qualityControl     = $('#quality-control');
  const qualitySlider      = $('#quality-slider');
  const qualityValue       = $('#quality-value');
  const convertBtn         = $('#convert-btn');
  const resultArea         = $('#result-area');
  const resultTitle        = $('#result-title');
  const resultFormat       = $('#result-format');
  const resultSize         = $('#result-size');
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

    autoSelectFormat(currentFile.type);
    convertBtn.disabled = false;
    resultArea.style.display = 'none';
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

  function removeFile() {
    currentFile = null;
    convertedBlob = null;
    fileInput.value = '';
    dropzone.classList.remove('has-file');
    dropzoneDefault.style.display = '';
    dropzoneFileInfo.style.display = 'none';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    convertBtn.disabled = true;
    resultArea.style.display = 'none';
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
  // Image Conversion
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

    convertBtn.classList.add('loading');
    convertBtn.disabled = true;

    try {
      const img = await loadImageFromFile(currentFile);

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);

      const blob = await canvasToBlob(targetMime, format === 'png' ? undefined : quality);
      convertedBlob = blob;

      const baseName = currentFile.name.replace(/\.[^.]+$/, '');
      const ext = format === 'jpeg' ? 'jpg' : format;
      convertedFileName = `${baseName}_converted.${ext}`;

      resultTitle.textContent = 'Conversion Complete!';
      resultFormat.textContent = format.toUpperCase();
      resultSize.textContent = formatBytes(blob.size);
      resultArea.style.display = 'block';

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

  updateQualityVisibility();
})();
