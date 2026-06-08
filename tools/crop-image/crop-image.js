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
  const cropControls = $('#crop-controls');
  const cropBtn = $('#crop-btn');
  const resultArea = $('#result-area');
  const downloadBtn = $('#download-btn');
  const ratioBtns = document.querySelectorAll('#ratio-pills .size-pill');

  let currentFile = null;
  let cropper = null;

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

    if (cropper) {
      cropper.destroy();
      cropper = null;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
      
      previewImg.onload = () => {
        cropper = new Cropper(previewImg, {
          viewMode: 1,
          autoCropArea: 0.8,
          responsive: true,
          restore: false
        });
        
        cropControls.style.display = 'flex';
        resultArea.style.display = 'none';
        
        ratioBtns.forEach(b => b.classList.remove('active'));
        ratioBtns[0].classList.add('active');
      };
    };
    reader.readAsDataURL(currentFile);
  }

  ratioBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!cropper) return;
      ratioBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const ratio = parseFloat(e.target.dataset.ratio);
      cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
    });
  });

  cropBtn.addEventListener('click', () => {
    if (!cropper || !currentFile) return;

    const canvas = cropper.getCroppedCanvas();
    if (!canvas) {
      showToast('Could not crop image', 'error');
      return;
    }

    const targetMime = currentFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
    
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      downloadBtn.href = url;
      downloadBtn.download = currentFile.name.replace(/\.[^.]+$/, '') + '_cropped' + (targetMime === 'image/png' ? '.png' : '.jpg');
      
      resultArea.style.display = 'block';
      showToast('Image cropped successfully!');
    }, targetMime, 0.9);
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = '';
    
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    
    dropzoneDefault.style.display = 'flex';
    dropzoneFileInfo.style.display = 'none';
    previewContainer.style.display = 'none';
    cropControls.style.display = 'none';
    resultArea.style.display = 'none';
    previewImg.src = '';
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
