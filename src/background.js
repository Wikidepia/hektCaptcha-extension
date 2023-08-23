'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// Setup settings
const defaultSettings = {
  auto_open: true,
  auto_solve: true,
  click_delay_time: 300,
  solve_delay_time: 3000,
  reload_delay_time: 0,
};

chrome.runtime.onInstalled.addListener(async (details) => {
  // Apply default settings if not set
  for (const [key, value] of Object.entries(defaultSettings)) {
    const storedValue = await chrome.storage.local.get(key);
    if (storedValue[key] === undefined) {
      await chrome.storage.local.set({ [key]: value });
    }
  }

  // Open setup page on install (for firefox)
  const isMozilla = chrome.runtime.getURL('').startsWith('moz');
  if (isMozilla && details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup.html'),
    });
  }
});

const kvStorage = {};
chrome.runtime.onMessage.addListener(function (
  { type, label },
  sender,
  sendResponse
) {
  (async () => {
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
    }
  })();
  return true;
});
