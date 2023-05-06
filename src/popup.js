'use strict';

import './popup.css';

function openPage(buttonElement) {
  const pageName = buttonElement.dataset.button;
  const tabContent = document.getElementsByClassName('tab-content');
  for (let i = 0; i < tabContent.length; i++) {
    tabContent[i].style.display = 'none';
  }

  const tabButton = document.getElementsByClassName('tab-button');
  for (let i = 0; i < tabButton.length; i++) {
    tabButton[i].style.backgroundColor = '';
  }

  document.querySelector(`[data-tab="${pageName}"]`).style.display = 'block';

  // Add active class to button
  buttonElement.classList.add('active');

  // Remove active class from other buttons
  for (let i = 0; i < tabButton.length; i++) {
    if (tabButton[i] !== buttonElement) {
      tabButton[i].classList.remove('active');
    }
  }
}

(function () {
  // We will make use of Storage API to get and store `count` value
  // More information on Storage API can we found at
  // https://developer.chrome.com/extensions/storage

  // To get storage access, we have to mention it in `permissions` property of manifest.json file
  // More information on Permissions can we found at
  // https://developer.chrome.com/extensions/declare_permissions

  function setupSetting() {
    // Restore settings
    chrome.storage.local.get(
      [
        'hcaptcha_auto_open',
        'hcaptcha_auto_solve',
        'hcaptcha_click_delay_time',
        'hcaptcha_solve_delay_time',
        'recaptcha_auto_open',
        'recaptcha_auto_solve',
        'recaptcha_click_delay_time',
        'recaptcha_solve_delay_time',
      ],
      async (e) => {
        const toggleElements =
          document.getElementsByClassName('settings_toggle');
        const textElements = document.getElementsByClassName('settings_text');
        for (const g of toggleElements) {
          g.classList.remove('on', 'off');
          g.classList.add(e[g.dataset.settings] ? 'on' : 'off');
        }
        for (const g of textElements) {
          g.value = e[g.dataset.settings];
        }
      }
    );

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

    // Register click event listener for tab buttons
    const tabButton = document.getElementsByClassName('tab-button');
    for (let i = 0; i < tabButton.length; i++) {
      tabButton[i].addEventListener('click', () => openPage(tabButton[i]));
    }
    document.querySelector('.tab-button').click();
  }
  document.addEventListener('DOMContentLoaded', setupSetting);
})();
