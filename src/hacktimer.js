let fakeIdToCallback = {};

function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

window.setInterval = function (callback, time /* , parameters */) {
  let fakeId = uuidv4();
  fakeIdToCallback[fakeId] = {
    callback: callback,
    parameters: Array.prototype.slice.call(arguments, 2),
  };
  chrome.runtime.sendMessage({
    type: 'HackTimer',
    label: {
      name: 'setInterval',
      fakeId,
      time,
    },
  });
  return fakeId;
};
window.clearInterval = function (fakeId) {
  if (fakeIdToCallback.hasOwnProperty(fakeId)) {
    delete fakeIdToCallback[fakeId];
    chrome.runtime.sendMessage({
      type: 'HackTimer',
      label: {
        name: 'clearInterval',
        fakeId,
      },
    });
  }
};
window.setTimeout = function (callback, time /* , parameters */) {
  let fakeId = uuidv4();
  fakeIdToCallback[fakeId] = {
    callback: callback,
    parameters: Array.prototype.slice.call(arguments, 2),
    isTimeout: true,
  };
  chrome.runtime.sendMessage({
    type: 'HackTimer',
    label: {
      name: 'setTimeout',
      fakeId,
      time,
    },
  });
  return fakeId;
};
window.clearTimeout = function (fakeId) {
  if (fakeIdToCallback.hasOwnProperty(fakeId)) {
    delete fakeIdToCallback[fakeId];
    chrome.runtime.sendMessage({
      type: 'HackTimer',
      label: {
        name: 'clearTimeout',
        fakeId,
      },
    });
  }
};

chrome.runtime.onMessage.addListener(function (
  { type, label } /*, sender, sendResponse*/
) {
  if (type === 'HackTimer') {
    let fakeId = label.fakeId,
      request,
      parameters,
      callback;
    if (fakeIdToCallback.hasOwnProperty(fakeId)) {
      request = fakeIdToCallback[fakeId];
      callback = request.callback;
      parameters = request.parameters;
      if (request.hasOwnProperty('isTimeout') && request.isTimeout) {
        delete fakeIdToCallback[fakeId];
      }
    }
    if (typeof callback === 'string') {
      console.error('Callback is not supported as string');
    }
    if (typeof callback === 'function') {
      callback.apply(window, parameters);
    }
  }
});
