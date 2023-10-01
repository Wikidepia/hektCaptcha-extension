let fakeIdToCallback = {},
  lastFakeId = 0,
  maxFakeId = 0x7fffffff; // 2 ^ 31 - 1, 31 bit, positive values of signed 32 bit integer
window.fakeIdToCallback = fakeIdToCallback;

function getFakeId() {
  do {
    if (lastFakeId === maxFakeId) {
      lastFakeId = 0;
    } else {
      lastFakeId++;
    }
  } while (fakeIdToCallback.hasOwnProperty(lastFakeId));
  return lastFakeId;
}

window.setInterval = function (callback, time /* , parameters */) {
  let fakeId = getFakeId();
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
  let fakeId = getFakeId();
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
