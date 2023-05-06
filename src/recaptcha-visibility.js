class Time {
  static sleep(i = 1000) {
    return new Promise((resolve) => setTimeout(resolve, i));
  }

  static async random_sleep(min, max) {
    const duration = Math.floor(Math.random() * (max - min) + min);
    return await Time.sleep(duration);
  }
}

(async () => {
  async function check_image_frame_visibility() {
    const $image_frames = [
      ...document.querySelectorAll('iframe[src*="/recaptcha/api2/bframe"]'),
      ...document.querySelectorAll(
        'iframe[src*="/recaptcha/enterprise/bframe"]'
      ),
    ];
    if ($image_frames.length > 0) {
      for (const $frame of $image_frames) {
        if (window.getComputedStyle($frame).visibility === 'visible') {
          return await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'KV_SET',
                label: {
                  key: 'recaptcha_image_visible',
                  value: true,
                  tab_specific: true,
                },
              },
              resolve
            );
          });
        }
      }
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'KV_SET',
            label: {
              key: 'recaptcha_image_visible',
              value: false,
              tab_specific: true,
            },
          },
          resolve
        );
      });
    }
  }

  async function check_widget_frame_visibility() {
    const $widget_frames = [
      ...document.querySelectorAll('iframe[src*="/recaptcha/api2/anchor"]'),
      ...document.querySelectorAll(
        'iframe[src*="/recaptcha/enterprise/anchor"]'
      ),
    ];
    if ($widget_frames.length > 0) {
      for (const $frame of $widget_frames) {
        if (window.getComputedStyle($frame).visibility === 'visible') {
          return await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'KV_SET',
                label: {
                  key: 'recaptcha_widget_visible',
                  value: true,
                  tab_specific: true,
                },
              },
              resolve
            );
          });
        }
      }
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'KV_SET',
            label: {
              key: 'recaptcha_widget_visible',
              value: false,
              tab_specific: true,
            },
          },
          resolve
        );
      });
    }
    return false;
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
