'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// Setup settings
const defaultSettings = {
  hcaptcha_auto_open: true,
  hcaptcha_auto_solve: true,
  hcaptcha_click_delay_time: 300,
  hcaptcha_solve_delay_time: 3000,
  hcaptcha_reload_delay_time: 0,

  recaptcha_auto_open: false,
  recaptcha_auto_solve: false,
  recaptcha_click_delay_time: 300,
  recaptcha_solve_delay_time: 1000,
};

chrome.runtime.onInstalled.addListener(async () => {
  // Apply default settings if not set
  for (const [key, value] of Object.entries(defaultSettings)) {
    const storedValue = await chrome.storage.local.get(key);
    console.log(storedValue);
    if (storedValue[key] === undefined) {
      await chrome.storage.local.set({ [key]: value });
    }
  }

  // Open setup page, if mozilla and permission is not granted
  const isMozilla = chrome.runtime.getURL('').startsWith('moz');
  const permissionGranted = await chrome.permissions.contains({
    origins: [
      '<all_urls>',
      '*://hekt-static.akmal.dev/*',
      '*://*.hcaptcha.com/captcha/*',
      '*://*.google.com/recaptcha/*',
      '*://*.recaptcha.net/recaptcha/*',
    ],
  });

  if (isMozilla && !permissionGranted) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup.html'),
    });
  }
});

const kvStorage = {};
let fakeIdToId = {};
chrome.runtime.onMessage.addListener(function (
  { type, label },
  sender,
  sendResponse
) {
  if (type === 'KV_SET') {
    if (label.tab_specific) {
      label.key = `${sender.tab.id}_${label.key}`;
    }
    kvStorage[label.key] = label.value;
    sendResponse({ status: 'success' });
  } else if (type === 'KV_GET') {
    if (label.tab_specific) {
      label.key = `${sender.tab.id}_${label.key}`;
    }
    sendResponse({ status: 'success', value: kvStorage[label.key] });
  } else if (type === 'HackTimer') {
    if (label.name === 'setInterval') {
      fakeIdToId[label.fakeId] = setInterval(function () {
        triggerTimer(label.name, sender, label.fakeId);
      }, label.time);
    } else if (label.name === 'clearInterval') {
      clearInterval(fakeIdToId[label.fakeId]);
      delete fakeIdToId[label.fakeId];
    } else if (label.name === 'setTimeout') {
      fakeIdToId[label.fakeId] = setTimeout(function () {
        triggerTimer(label.name, sender, label.fakeId);
        delete fakeIdToId[label.fakeId];
      }, label.time);
    } else if (label.name === 'clearTimeout') {
      clearTimeout(fakeIdToId[label.fakeId]);
      delete fakeIdToId[label.fakeId];
    }
  }
});

async function triggerTimer(name, sender, fakeId) {
  try {
    await chrome.tabs.sendMessage(
      sender.tab.id,
      {
        type: 'HackTimer',
        label: { fakeId },
      },
      {
        documentId: sender.documentId,
        frameId: sender.frameId,
      }
    );
  } catch (error) {
    if (name === 'setInterval') clearInterval(fakeIdToId[fakeId]);
    delete fakeIdToId[fakeId];
  }
}
