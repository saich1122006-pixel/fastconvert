let backgroundRemovalModule = null;

self.onmessage = async function (event) {
  var message = event.data;
  if (!message || message.type !== 'remove-background') return;

  try {
    if (!backgroundRemovalModule) {
      backgroundRemovalModule = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm');
    }

    var outputBlob = await backgroundRemovalModule.removeBackground(message.file, {
      progress: function (key, current, total) {
        if (key === 'compute:inference' && total) {
          self.postMessage({
            type: 'progress',
            current: current,
            total: total
          });
        }
      }
    });

    self.postMessage({ type: 'complete', blob: outputBlob });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error && error.message ? error.message : 'Background removal failed.'
    });
  }
};
