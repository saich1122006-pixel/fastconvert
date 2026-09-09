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

    if (message.mobile) {
      config.device = 'cpu';
      config.model = 'isnet_quint8';
    }

    var outputBlob;
    try {
      outputBlob = await backgroundRemovalModule.removeBackground(message.file, config);
    } catch (error) {
      if (!message.mobile) throw error;

      // Retry with the default model if the cached mobile model is unavailable.
      delete config.model;
      config.device = 'cpu';
      outputBlob = await backgroundRemovalModule.removeBackground(message.file, config);
    }

    self.postMessage({ type: 'complete', blob: outputBlob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : 'Background removal failed on this device.'
    });
  }
};

