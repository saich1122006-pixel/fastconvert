(function () {
  'use strict';

  const qrText = $('#qr-text');
  const generateBtn = $('#generate-btn');
  const resultArea = $('#result-area');
  const qrCanvas = $('#qr-canvas');
  const downloadBtn = $('#download-btn');

  let currentQrDataUrl = null;

  function generateQR() {
    const text = qrText.value.trim();
    if (!text) {
      showToast('Please enter text or a URL', 'error');
      return;
    }

    // Clear previous
    const ctx = qrCanvas.getContext('2d');
    ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);

    QRCode.toCanvas(qrCanvas, text, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }, function (error) {
      if (error) {
        console.error(error);
        showToast('Failed to generate QR code', 'error');
        return;
      }
      
      currentQrDataUrl = qrCanvas.toDataURL('image/png');
      resultArea.style.display = 'block';
      showToast('QR Code generated!', 'success');
    });
  }

  generateBtn.addEventListener('click', generateQR);
  qrText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      generateQR();
    }
  });

  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentQrDataUrl) return;

    const a = document.createElement('a');
    a.href = currentQrDataUrl;
    a.download = 'qrcode.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('Download started!', 'success');
  });

})();
