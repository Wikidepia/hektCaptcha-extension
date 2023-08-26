'use strict';

import { KVStorage, Time } from './utils.js';

(async () => {
  async function check_image_frame_visibility() {
    const $image_frames = document.querySelectorAll(
      'iframe[src*="/recaptcha/api2/bframe"], iframe[src*="/recaptcha/enterprise/bframe"]'
    );
    for (const $frame of $image_frames) {
      if (window.getComputedStyle($frame).visibility === 'visible') {
        return await KVStorage.set({
          key: 'recaptcha_image_visible',
          value: true,
          tab_specific: true,
        });
      }
    }
    if ($image_frames.length > 0) {
      return await KVStorage.set({
        key: 'recaptcha_image_visible',
        value: false,
        tab_specific: true,
      });
    }
  }

  async function check_widget_frame_visibility() {
    const $widget_frames = document.querySelectorAll(
      'iframe[src*="/recaptcha/api2/anchor"], iframe[src*="/recaptcha/enterprise/anchor"]'
    );
    for (const $frame of $widget_frames) {
      if (window.getComputedStyle($frame).visibility === 'visible') {
        return await KVStorage.set({
          key: 'recaptcha_widget_visible',
          value: true,
          tab_specific: true,
        });
      }
    }
    if ($widget_frames.length > 0) {
      return await KVStorage.set({
        key: 'recaptcha_widget_visible',
        value: false,
        tab_specific: true,
      });
    }
  }

  while (true) {
    await Time.sleep(1000);
    if (!chrome.runtime?.id) {
      continue;
    }

    await check_image_frame_visibility();
    await check_widget_frame_visibility();
  }
})();
