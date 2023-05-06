'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// Setup settings
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    hcaptcha_auto_open: true,
    hcaptcha_auto_solve: true,
    hcaptcha_click_delay_time: 300,
    hcaptcha_solve_delay_time: 3000,

    recaptcha_auto_open: true,
    recaptcha_auto_solve: true,
    recaptcha_click_delay_time: 300,
    recaptcha_solve_delay_time: 1000,
  });
});

const convertBlobToBase64 = async (blob) => {
  const reader = new FileReader();
  return new Promise((resolve) => {
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
};

chrome.runtime.onMessage.addListener(function (
  { type, label },
  sender,
  sendResponse
) {
  (async () => {
    if (type === 'CLASSIFIER') {
      const modelURL = `https://hekt.akmal.dev/${label}.ort`;
      try {
        const response = await fetch(modelURL);
        const blob = await response.blob();
        const base64 = await convertBlobToBase64(blob);
        sendResponse({ status: response.status, base64: base64 });
      } catch (error) {
        sendResponse({ status: 'error', message: error.message });
      }
    }
  })();
  return true;
});
