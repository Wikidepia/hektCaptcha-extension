'use strict';

import './popup.css';

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  function setupSetting() {
    // Restore settings
    chrome.storage.local.get(["auto_open", "auto_solve", "solve_delay_time"],
      async (e) => {
        const toggleElements = document.getElementsByClassName("settings_toggle");
        const textElements = document.getElementsByClassName("settings_text");
        for (const g of toggleElements) {
          g.classList.remove("on", "off");
          g.classList.add(e[g.dataset.settings] ? "on" : "off");
        }
        for (const g of textElements) {
          g.value = e[g.dataset.settings];
        }
      });

    // Add change listener to settings
    const handleSettingChange = async (element) => {
      var value = element.classList.contains("settings_toggle") ? element.classList.contains("off") : element.value;
      await chrome.storage.local.set({ [element.dataset.settings]: value });
      if (element.classList.contains("settings_toggle")) {
        element.classList.remove("on", "off");
        element.classList.add(value ? "on" : "off");
      }
    }

    for (const element of document.querySelectorAll(`.settings_toggle, .settings_text`)) {
      if (element.classList.contains("settings_toggle")) {
        element.addEventListener("click", () => handleSettingChange(element));
      } else if (element.classList.contains("settings_text")) {
        element.addEventListener("input", () => handleSettingChange(element));
      }
    }
  }

  document.addEventListener('DOMContentLoaded', setupSetting);
})();
