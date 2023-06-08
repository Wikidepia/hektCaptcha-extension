'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

// Setup settings
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    auto_open: true,
    auto_solve: true,
    click_delay_time: 300,
    solve_delay_time: 3000,
  });
});
