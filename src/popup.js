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
        for (const g of document.querySelectorAll(`.settings_toggle`))
          g.classList.remove("on", "off"),
          g.classList.add(e[g.dataset.settings] ? "on" : "off");

        for (const g of document.querySelectorAll(`.settings_text`))
          g.value = e[g.dataset.settings];
      });

    // Add change listener to settings
    for (const g of document.querySelectorAll(`.settings_toggle`))
      g.addEventListener("click", async () => {
        var e = g.classList.contains("off");
        await chrome.storage.local.set({
            [g.dataset.settings]: e
          }),
          g.classList.remove("on", "off"),
          g.classList.add(e ? "on" : "off")
      });

    for (const g of document.querySelectorAll(`.settings_text`))
      g.addEventListener("change", async () => {
        var e = g.value;
        await chrome.storage.local.set({
          [g.dataset.settings]: e
        });
      });

  }

  document.addEventListener('DOMContentLoaded', setupSetting);
})();
