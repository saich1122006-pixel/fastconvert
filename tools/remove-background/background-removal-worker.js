let backgroundRemovalModule = null;

self.onmessage = async function (event) {
  var message = event.data;
  if (!message || message.type !== 'remove-background') return;

  try {
    if (!backgroundRemovalModule) {
      backgroundRemovalModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');
    }

    var config = {
      progress: function (key, current, total) {
        if (key === 'compute:inference' && total) {
          self.postMessage({
            type: 'progress',
            current: current,
            total: total
          });
        }
      }
    };

    // The quantized model uses much less memory on mobile devices.
    if (message.mobile) config.model = 'isnet_quint8';

    var outputBlob = await backgroundRemovalModule.removeBackground(message.file, config);

    self.postMessage({ type: 'complete', blob: outputBlob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : 'Background removal failed on this device.'
    });
  }
};

