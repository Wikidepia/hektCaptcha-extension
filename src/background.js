'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

const convertBlobToBase64 = blob => new Promise(resolve => {
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = () => {
      const base64data = reader.result;
      resolve(base64data);
  };
});


chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    var model_url =
      `https://github.com/Wikidepia/hektCaptcha-extension/releases/download/modelhub/${request}.ort`
    const fetchModel = async () => {
      const response = await fetch(model_url);
      const respBlob = await response.blob();
      const base64 = await convertBlobToBase64(respBlob);

      sendResponse({ status: response.status, model: base64 });
    }
    fetchModel()
    return true;
  }
);

(function () {
    // Setup settings
    chrome.runtime.onInstalled.addListener(async () => {
      await chrome.storage.local.set({ auto_open: true, auto_solve: true, solve_delay_time: 3000 });
    });
  }
)()
