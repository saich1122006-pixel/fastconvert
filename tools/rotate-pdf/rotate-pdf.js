(function () {
  'use strict';

  const fileInput = $('#file-input');
  const dropzone = $('#dropzone');
  const dropzoneDefault = $('#dropzone-default');
  const dropzoneFileInfo = $('#dropzone-file-info');
  const fileNameEl = $('#file-name');
  const fileSizeEl = $('#file-size');
  const removeFileBtn = $('#remove-file');
  const rotateControls = $('#rotate-controls');
  const applyBtn = $('#apply-btn');
  const resultArea = $('#result-area');
  const downloadBtn = $('#download-btn');
  
  const rotateBtns = document.querySelectorAll('.size-pill');

  let currentFile = null;
  let rotationDegrees = -90;

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

  function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a valid PDF file.', 'error');
      return;
    }

    currentFile = file;

    dropzoneDefault.style.display = 'none';
    dropzoneFileInfo.style.display = 'flex';
    fileNameEl.textContent = currentFile.name;
    fileSizeEl.textContent = formatBytes(currentFile.size);

    rotateControls.style.display = 'flex';
    resultArea.style.display = 'none';
  }

  rotateBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      rotateBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      rotationDegrees = parseInt(e.target.dataset.degrees, 10);
    });
  });

  applyBtn.addEventListener('click', async () => {
    if (!currentFile || !window.PDFLib) return;

    applyBtn.disabled = true;
    applyBtn.querySelector('.spinner').style.display = 'inline-block';

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      pages.forEach(page => {
        const currentRotation = page.getRotation().angle;
        page.setRotation(PDFLib.degrees(currentRotation + rotationDegrees));
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      downloadBtn.href = url;
      downloadBtn.download = currentFile.name.replace(/\.pdf$/i, '') + '_rotated.pdf';
      
      resultArea.style.display = 'block';
      showToast('PDF rotated successfully!');
    } catch (error) {
      console.error(error);
      showToast('Error rotating PDF. The file may be password protected.', 'error');
    } finally {
      applyBtn.disabled = false;
      applyBtn.querySelector('.spinner').style.display = 'none';
    }
  });

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = '';
    dropzoneDefault.style.display = 'flex';
    dropzoneFileInfo.style.display = 'none';
    rotateControls.style.display = 'none';
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
