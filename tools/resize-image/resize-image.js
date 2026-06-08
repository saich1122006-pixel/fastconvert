(function () {
  'use strict';

  const fileInput = $('#file-input');
  const dropzone = $('#dropzone');
  const dropzoneDefault = $('#dropzone-default');
  const dropzoneFileInfo = $('#dropzone-file-info');
  const fileNameEl = $('#file-name');
  const fileSizeEl = $('#file-size');
  const removeFileBtn = $('#remove-file');
  const previewContainer = $('#image-preview');
  const previewImg = $('#preview-img');
  const resizeControls = $('#resize-controls');
  const widthInput = $('#width-input');
  const heightInput = $('#height-input');
  const maintainRatioCb = $('#maintain-ratio');
  const resizeBtn = $('#resize-btn');
  const resultArea = $('#result-area');
  const resultDims = $('#result-dims');
  const downloadBtn = $('#download-btn');

  let currentFile = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let aspectRatio = 1;

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function showToast(message, type = 'success') {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast';
    toast.classList.add(type, 'visible');
    setTimeout(() => toast.classList.remove('visible'), 3500);
  }

  async function handleFile(file) {
    if (!file.type.startsWith('image/') && !['heic','heif'].includes(file.name.split('.').pop().toLowerCase())) {
      showToast('Please select a valid image file.', 'error');
      return;
    }

    if (file.name.match(/\.(heic|heif)$/i) || file.type === 'image/heic') {
      showToast('Decoding HEIC...', 'success');
      try {
        const blob = await heic2any({ blob: file, toType: 'image/png', quality: 1 });
        const pngBlob = Array.isArray(blob) ? blob[0] : blob;
        currentFile = new File([pngBlob], file.name.replace(/\.(heic|heif)$/i, '.png'), { type: 'image/png' });
      } catch(e) {
        showToast('Failed to decode HEIC.', 'error');
        return;
      }
    } else {
      currentFile = file;
    }

    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileNameEl.textContent = currentFile.name;
    fileSizeEl.textContent = formatBytes(currentFile.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'flex';
      
      const img = new Image();
      img.onload = () => {
        originalWidth = img.naturalWidth;
        originalHeight = img.naturalHeight;
        aspectRatio = originalWidth / originalHeight;
        
        widthInput.value = originalWidth;
        heightInput.value = originalHeight;
        
        resizeControls.style.display = 'flex';
        resultArea.style.display = 'none';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(currentFile);
  }

  widthInput.addEventListener('input', () => {
    if (maintainRatioCb.checked && widthInput.value) {
      heightInput.value = Math.round(widthInput.value / aspectRatio);
    }
  });

  heightInput.addEventListener('input', () => {
    if (maintainRatioCb.checked && heightInput.value) {
      widthInput.value = Math.round(heightInput.value * aspectRatio);
    }
  });

  maintainRatioCb.addEventListener('change', () => {
    if (maintainRatioCb.checked && widthInput.value) {
      heightInput.value = Math.round(widthInput.value / aspectRatio);
    }
  });

  resizeBtn.addEventListener('click', () => {
    if (!currentFile || !widthInput.value || !heightInput.value) return;

    const canvas = document.createElement('canvas');
    canvas.width = parseInt(widthInput.value, 10);
    canvas.height = parseInt(heightInput.value, 10);
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const targetMime = currentFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        downloadBtn.href = url;
        downloadBtn.download = currentFile.name.replace(/\.[^.]+$/, '') + '_resized' + (targetMime === 'image/png' ? '.png' : '.jpg');
        
        resultDims.textContent = `${canvas.width} x ${canvas.height} px`;
        resultArea.style.display = 'block';
        showToast('Image resized successfully!');
      }, targetMime, 0.9);
    };
    img.src = previewImg.src;
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = '';
    dropzoneDefault.style.display = 'flex';
    dropzoneFileInfo.style.display = 'none';
    previewContainer.style.display = 'none';
    resizeControls.style.display = 'none';
    resultArea.style.display = 'none';
  });

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#remove-file')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(e => dropzone.addEventListener(e, ev => {
    ev.preventDefault();
    dropzone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, ev => {
    ev.preventDefault();
    dropzone.classList.remove('drag-over');
  }));
  dropzone.addEventListener('drop', e => {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
})();
