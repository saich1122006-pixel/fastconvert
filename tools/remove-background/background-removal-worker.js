let backgroundRemovalModule = null;

self.onmessage = async function (event) {
  var message = event.data;
  if (!message || message.type !== 'remove-background') return;

  var stage = 'starting';

  try {
    stage = 'loading AI library';
    if (!backgroundRemovalModule) {
      backgroundRemovalModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');
    }

    var config = {
      proxyToWorker: false,
      progress: function (key, current, total) {
        stage = key || 'processing image';
        if (key === 'compute:inference' && total) {
          self.postMessage({
            type: 'progress',
            current: current,
            total: total
          });
        }
      }
    };

    stage = 'loading model and decoding image';
    var outputBlob = await backgroundRemovalModule.removeBackground(message.file, config);

    self.postMessage({ type: 'complete', blob: outputBlob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: 'Failed while ' + stage + ': ' + (error && error.message ? error.message : 'unknown error')
    });
  }
};

