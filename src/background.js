'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// Setup settings
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ auto_open: true, auto_solve: true, click_delay_time: 300, solve_delay_time: 3000 });
});

const convertBlobToBase64 = async blob => {
  const reader = new FileReader();
  return new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
   (async () => {
      const modelURL = `https://github.com/Wikidepia/hektCaptcha-model/releases/download/modelzoo/${request}.ort`;
      try {
        const response = await fetch(modelURL);
        const blob = await response.blob();
        const base64 = await convertBlobToBase64(blob);
        sendResponse({ status: response.status, model: base64 });
      } catch (error) {
        sendResponse({ status: "error", message: error.message });
      }
    })()
    return true;
  }
);
