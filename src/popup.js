'use strict';

import './popup.css';

export const settingsDefault = {
  auto_open: true,
  auto_solve: true,
  click_delay_time: 300,
  solve_delay_time: 3000,
  reload_delay_time: 500,
};

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  // Add change listener to settings
  async function handleSettingChange(element) {
    var value = element.classList.contains('settings_toggle')
      ? element.classList.contains('off')
      : parseInt(element.value);

    await chrome.storage.local.set({ [element.dataset.settings]: value });
    if (element.classList.contains('settings_toggle')) {
      element.classList.remove('on', 'off');
      element.classList.add(value ? 'on' : 'off');
    }
  }

  function setupSetting() {
    // Restore settings
    const toggleElements = document.getElementsByClassName('settings_toggle');
    const textElements = document.getElementsByClassName('settings_text');

    chrome.storage.local.get(null, async (e) => {
      for (const key of Object.keys(settingsDefault)) {
        if (e[key] === undefined) {
          await chrome.storage.local.set({ [key]: settingsDefault[key] });
          e[key] = settingsDefault[key];
        }
      }

      for (const element of toggleElements) {
        element.classList.remove('on', 'off');
        element.classList.add(e[element.dataset.settings] ? 'on' : 'off');
        element.addEventListener('click', () => handleSettingChange(element));
      }

      for (const element of textElements) {
        element.value = e[element.dataset.settings];
        element.addEventListener('input', () => handleSettingChange(element));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', setupSetting);
})();
