'use strict';

import './popup.css';

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  const settingsDefault = {
    auto_open: true,
    auto_solve: true,
    click_delay_time: 300,
    solve_delay_time: 3000,
  };

  function setupSetting() {
    // Restore settings
    chrome.storage.local.get(null, async (e) => {
      const toggleElements = Array.from(
        document.getElementsByClassName('settings_toggle')
      );
      const textElements = Array.from(
        document.getElementsByClassName('settings_text')
      );

      for (const key of Object.keys(settingsDefault)) {
        if (e[key] === undefined) {
          await chrome.storage.local.set({ [key]: settingsDefault[key] });
          e[key] = settingsDefault[key];
        }
      }

      for (let i = 0; i < toggleElements.length; i++) {
        const toggle = toggleElements[i];
        const text = textElements[i];

        toggle.classList.remove('on', 'off');
        toggle.classList.add(e[toggle.dataset.settings] ? 'on' : 'off');
        text.value = e[text.dataset.settings];
      }
    });

    // Add change listener to settings
    const handleSettingChange = async (element) => {
      var value = element.classList.contains('settings_toggle')
        ? element.classList.contains('off')
        : element.value;
      await chrome.storage.local.set({ [element.dataset.settings]: value });
      if (element.classList.contains('settings_toggle')) {
        element.classList.remove('on', 'off');
        element.classList.add(value ? 'on' : 'off');
      }
    };

    for (const element of document.querySelectorAll(
      `.settings_toggle, .settings_text`
    )) {
      if (element.classList.contains('settings_toggle')) {
        element.addEventListener('click', () => handleSettingChange(element));
      } else if (element.classList.contains('settings_text')) {
        element.addEventListener('input', () => handleSettingChange(element));
      }
    }
  }

  document.addEventListener('DOMContentLoaded', setupSetting);
})();
