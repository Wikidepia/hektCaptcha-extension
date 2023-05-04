'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

import Jimp from 'jimp';
const ort = require('onnxruntime-web');

const extension_id = chrome.runtime.id;

// Modify ort wasm path
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': `chrome-extension://${extension_id}/dist/ort-wasm.wasm`,
  'ort-wasm-threaded.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-threaded.wasm`,
  'ort-wasm-simd.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-simd.wasm`,
  'ort-wasm-simd-threaded.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-simd-threaded.wasm`,
};

function imageDataToTensor(image, dims, normalize = true) {
  // 1. Get buffer data from image and extract R, G, and B arrays.
  var imageBufferData = image.bitmap.data;
  const [redArray, greenArray, blueArray] = [[], [], []];

  // 2. Loop through the image buffer and extract the R, G, and B channels
  for (let i = 0; i < imageBufferData.length; i += 4) {
    redArray.push(imageBufferData[i]);
    greenArray.push(imageBufferData[i + 1]);
    blueArray.push(imageBufferData[i + 2]);
  }

  // 3. Concatenate RGB to transpose [224, 224, 3] -> [3, 224, 224] to a number array
  const transposedData = redArray.concat(greenArray, blueArray);

  // 4. Convert to float32 and normalize to 1
  const float32Data = new Float32Array(transposedData.map((x) => x / 255.0));

  // 5. Normalize the data mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
  if (normalize) {
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    for (let i = 0; i < float32Data.length; i++) {
      float32Data[i] = (float32Data[i] - mean[i % 3]) / std[i % 3];
    }
  }

  // 6. Create a tensor from the float32 data
  const inputTensor = new ort.Tensor('float32', float32Data, dims);
  return inputTensor;
}

async function simulateMouseClick(element) {
  const box = element.getBoundingClientRect();
  let clientX = 0;
  let clientY = 0;
  const screenX = 50 + Math.floor(Math.random() * 100);
  const screenY = 50 + Math.floor(Math.random() * 200);

  // Create array with random amount of string 'mousemove'
  const randomMove = new Array(Math.floor(Math.random() * 10)).fill(
    'mousemove'
  );

  // Send mouseover, mousedown, mouseup, click, mouseout
  const eventNames = [
    'mouseover',
    'mouseenter',
    ...randomMove,
    'mousedown',
    'mouseup',
    'click',
    'mouseout',
  ];

  for (let i = 0; i < eventNames.length; i++) {
    const eventName = eventNames[i];
    if (eventName !== 'mouseenter' && eventName !== 'mouseout') {
      clientX = box.left + box.width / 2;
      clientY = box.top + box.height / 2;
    } else {
      clientX = box.left + (eventName === 'mouseenter' ? 0 : box.width);
      clientY = box.top + (eventName === 'mouseenter' ? 0 : box.height);
    }

    // Add random offset
    clientX += Math.random() * 10 - 5;
    clientY += Math.random() * 20 - 5;

    const detail = eventName === 'mouseover' ? 0 : 1;
    const event = new MouseEvent(eventName, {
      detail: detail,
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: clientX,
      clientY: clientY,
      screenX: screenX,
      screenY: screenY,
      sourceCapabilities: new InputDeviceCapabilities({
        firesTouchEvents: false,
      }),
    });
    element.dispatchEvent(event);
    await Time.random_sleep(0, 10);
  }
}

class Time {
  static time() {
    if (!Date.now) {
      Date.now = () => new Date().getTime();
    }
    return Date.now();
  }

  static sleep(i = 1000) {
    return new Promise((resolve) => setTimeout(resolve, i));
  }

  static async random_sleep(min, max) {
    const duration = Math.floor(Math.random() * (max - min) + min);
    return await Time.sleep(duration);
  }
}

(async () => {
  function is_widget_frame() {
    return document.querySelector('.recaptcha-checkbox') !== null;
  }

  function is_image_frame() {
    return document.querySelector('#rc-imageselect') !== null;
  }

  function open_image_frame() {
    simulateMouseClick(document.querySelector('#recaptcha-anchor'));
  }

  function is_invalid_config() {
    return document.querySelector('.rc-anchor-error-message') !== null;
  }

  function is_rate_limited() {
    return document.querySelector('.rc-doscaptcha-header') !== null;
  }

  function is_solved() {
    const is_widget_frame_solved =
      document
        .querySelector('.recaptcha-checkbox')
        ?.getAttribute('aria-checked') === 'true';
    // Note: verify button is disabled after clicking and during transition to the next image task
    const is_image_frame_solved = document.querySelector(
      '#recaptcha-verify-button'
    )?.disabled;
    return is_widget_frame_solved || is_image_frame_solved;
  }

  function on_images_ready(timeout = 15000) {
    return new Promise(async (resolve) => {
      const start = Time.time();
      while (true) {
        const $tiles = document.querySelectorAll('.rc-imageselect-tile');
        const $loading = document.querySelectorAll(
          '.rc-imageselect-dynamic-selected'
        );
        const is_loaded = $tiles.length > 0 && $loading.length === 0;
        if (is_loaded) {
          return resolve(true);
        }
        if (Time.time() - start > timeout) {
          return resolve(false);
        }
        await Time.sleep(100);
      }
    });
  }

  function get_image_url($e) {
    return $e?.src?.trim();
  }

  async function get_task(task_lines) {
    let task = null;
    if (task_lines.length > 1) {
      task = task_lines.slice(0, 2).join(' ');
      task = task.replace(/\s+/g, ' ')?.trim();
    } else {
      task = task.join('\n');
    }
    if (!task) {
      return null;
    }
    return task;
  }

  let last_urls_hash = null;
  function on_task_ready(i = 500) {
    return new Promise((resolve) => {
      let checking = false;
      const check_interval = setInterval(async () => {
        if (checking) {
          return;
        }
        checking = true;

        const task_lines = document
          .querySelector('.rc-imageselect-instructions')
          ?.innerText?.split('\n');
        let task = await get_task(task_lines);
        if (!task) {
          checking = false;
          return;
        }

        const is_hard = task_lines.length === 3 ? true : false;

        const $cells = document.querySelectorAll('table tr td');
        if ($cells.length !== 9 && $cells.length !== 16) {
          checking = false;
          return;
        }

        const cells = [];
        const urls = Array($cells.length).fill(null);
        let background_url = null;
        let has_secondary_images = false;
        let i = 0;
        for (const $e of $cells) {
          const $img = $e?.querySelector('img');
          if (!$img) {
            checking = false;
            return;
          }

          const url = get_image_url($img);
          if (!url || url === '') {
            checking = false;
            return;
          }

          if ($img.naturalWidth >= 300) {
            background_url = url;
          } else if ($img.naturalWidth == 100) {
            urls[i] = url;
            has_secondary_images = true;
          }

          cells.push($e);
          i++;
        }
        if (has_secondary_images) {
          background_url = null;
        }

        const urls_hash = JSON.stringify([background_url, urls]);
        if (last_urls_hash === urls_hash) {
          checking = false;
          return;
        }
        last_urls_hash = urls_hash;

        clearInterval(check_interval);
        checking = false;
        return resolve({ task, is_hard, cells, background_url, urls });
      }, i);
    });
  }

  function submit() {
    simulateMouseClick(document.querySelector('#recaptcha-verify-button'));
  }

  function reload() {
    simulateMouseClick(document.querySelector('#recaptcha-reload-button'));
  }

  function got_solve_incorrect() {
    const errors = [
      '.rc-imageselect-incorrect-response', // try again
    ];
    for (const e of errors) {
      if (document.querySelector(e)?.style['display'] === '') {
        return true;
      }
    }
    return false;
  }

  function got_solve_error() {
    // <div aria-live="polite">
    //     <div class="rc-imageselect-error-select-more" style="" tabindex="0">Please select all matching images.</div>
    //     <div class="rc-imageselect-error-dynamic-more" style="display:none">Please also check the new images.</div>
    //     <div class="rc-imageselect-error-select-something" style="display:none">Please select around the object, or reload if there are none.</div>
    // </div>

    const errors = [
      '.rc-imageselect-error-select-more', // select all matching images
      '.rc-imageselect-error-dynamic-more', // please also check the new images
      '.rc-imageselect-error-select-something', // select around the object or reload
    ];
    for (const e of errors) {
      const $e = document.querySelector(e);
      if ($e?.style['display'] === '' || $e?.tabIndex === 0) {
        return true;
      }
    }
    return false;
  }

  function is_cell_selected($cell) {
    try {
      return $cell.classList.contains('rc-imageselect-tileselected');
    } catch {}
    return false;
  }

  async function on_widget_frame() {
    // Check if parent frame marked this frame as visible on screen
    // const is_visible = await BG.exec('Cache.get', {name: 'recaptcha_widget_visible', tab_specific: true});
    // if (is_visible !== true) {
    //     return;
    // }

    // Wait if already solved
    if (is_solved()) {
      if (!was_solved) {
        was_solved = true;
      }
      return;
    }
    was_solved = false;
    await Time.sleep(500);
    open_image_frame();
  }

  async function on_image_frame(settings) {
    // Check if parent frame marked this frame as visible on screen
    // const is_visible = await BG.exec('Cache.get', {name: 'recaptcha_image_visible', tab_specific: true});
    // if (is_visible !== true) {
    //     return;
    // }

    // Wait if verify button or rate limited or invalid config
    if (is_solved() || is_rate_limited() || is_invalid_config()) {
      return;
    }

    // Incorrect solution
    if (!was_incorrect && got_solve_incorrect()) {
      solved_urls = [];
      was_incorrect = true;
    } else {
      was_incorrect = false;
    }

    // Select more images error
    if (got_solve_error()) {
      solved_urls = [];
      return reload();
    }

    // Wait for images to load
    const is_ready = await on_images_ready();
    if (!is_ready) {
      return;
    }

    // Wait for task to be available
    const { task, is_hard, cells, background_url, urls } =
      await on_task_ready();

    const image_urls = [];
    const n = cells.length == 9 ? 3 : 4;
    let clickable_cells = []; // Variable number of clickable cells if secondary images appear
    if (background_url === null) {
      urls.forEach((url, i) => {
        if (url && !solved_urls.includes(url)) {
          image_urls.push(url);
          clickable_cells.push(cells[i]);
        }
      });
    } else {
      image_urls.push(background_url);
      clickable_cells = cells;
    }

    const normalizedLabel = {
      bicycles: 'bicycle',
      bridges: 'bridge',
      buses: 'bus',
      cars: 'car',
      chimneys: 'chimney',
      crosswalks: 'crosswalk',
      'fire hydrants': 'fire hydrant',
      motorcycles: 'motorcycle',
      mountains: 'mountain or hill',
      'palm trees': 'palm tree',
      taxis: 'taxi',
      stairs: 'stair',
      'traffic lights': 'traffic light',
      tractors: 'tractor',
      vehicles: 'car',
    };

    const modelLabel = [
      'bicycle',
      'bridge',
      'bus',
      'car',
      'chimney',
      'crosswalk',
      'fire hydrant',
      'motorcycle',
      'mountain or hill',
      'palm tree',
      'parking meter',
      'stair',
      'taxi',
      'tractor',
      'traffic light',
      'truck',
    ];

    const data = Array(16).fill(false);
    let label = task
      .replace('Select all squares with', '')
      .replace('Select all images with', '')
      .trim()
      .replace(/^(a|an)\s+/i, '')
      .toLowerCase();
    label = normalizedLabel[label] || label;

    const subImages = [];
    if (background_url === null) {
      for (const url of image_urls) {
        subImages.push(await Jimp.read(url).then((img) => img.rgba(false)));
      }
    } else {
      const image = await Jimp.read(background_url).then((img) =>
        img.rgba(false)
      );

      if (n == 4) {
        subImages.push(image);
      } else {
        const cropSize = image.bitmap.width / n;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            subImages.push(
              image.clone().crop(j * cropSize, i * cropSize, cropSize, cropSize)
            );
          }
        }
      }
    }

    // Initialize model
    const imageSize = 320;
    const session = await ort.InferenceSession.create(
      `chrome-extension://${extension_id}/models/recaptcha.ort`
    );

    // Initialize NMS
    const configNMS = new ort.Tensor(
      'float32',
      new Float32Array([10, 0.35, 0.1])
    );
    const nmsSession = await ort.InferenceSession.create(
      `chrome-extension://${extension_id}/models/nms.ort`
    );

    for (let idxImage = 0; idxImage < subImages.length; idxImage++) {
      const subImage = subImages[idxImage];

      const inputImage = subImage.resize(imageSize, imageSize);
      const inputTensor = imageDataToTensor(
        inputImage,
        [1, 3, imageSize, imageSize],
        false
      );

      // YOLOv5 detector
      const outputMap = await session.run({ images: inputTensor });
      const output0 = outputMap[session.outputNames[0]];

      // NMS (Non-Maximum Suppression)
      const nmsOutput = await nmsSession.run({
        detection: outputMap[session.outputNames[0]],
        config: configNMS,
      });
      const selectedIdx = nmsOutput[nmsSession.outputNames[0]];

      for (let i = 0; i < selectedIdx.data.length; i++) {
        const idx = selectedIdx.data[i];
        const selectedData = output0.data.slice(
          idx * output0.dims[2],
          (idx + 1) * output0.dims[2]
        );

        const scores = selectedData.slice(5);
        const score = Math.max(...scores);
        const labelName = modelLabel[scores.indexOf(score)];
        if (labelName !== label) continue;

        if (n === 4) {
          const [x, y, w, h] = selectedData.slice(0, 4);
          const [x1, y1, x2, y2] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];

          // Calculate the row and column indices of
          // the top-left and bottom-right cells of the bounding box
          const cellSize = imageSize / n;
          const [tl_row, tl_col, br_row, br_col] = [
            Math.floor(y1 / cellSize),
            Math.floor(x1 / cellSize),
            Math.floor(y2 / cellSize),
            Math.floor(x2 / cellSize),
          ];

          // Iterate over the cells in the 4x4 grid
          // and check if each cell needs to be clicked
          for (let i = 0; i < 16; i++) {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const withinRange =
              tl_row <= row && row <= br_row && tl_col <= col && col <= br_col;

            data[i] = withinRange ? true : data[i] ?? false;
          }
        } else if (n === 3) {
          data[idxImage] = true;
          break;
        }
      }
    }

    let clicks = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === false) {
        continue;
      }
      clicks++;

      // Click if not already selected
      if (!is_cell_selected(clickable_cells[i])) {
        simulateMouseClick(clickable_cells[i]);
        await Time.random_sleep(100, 200);
      }
    }

    for (const url of urls) {
      solved_urls.push(url);
      if (solved_urls.length > 9) {
        solved_urls.shift();
      }
    }

    await Time.sleep(settings.solve_delay_time);
    if (
      (n === 3 && is_hard && clicks === 0 && (await on_images_ready())) ||
      (n === 3 && !is_hard) ||
      n === 4
    ) {
      await Time.sleep(200);
      submit();
    }
  }

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
          return await BG.exec('Cache.set', {
            name: 'recaptcha_image_visible',
            value: true,
            tab_specific: true,
          });
        }
      }
      await BG.exec('Cache.set', {
        name: 'recaptcha_image_visible',
        value: false,
        tab_specific: true,
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
          return await BG.exec('Cache.set', {
            name: 'recaptcha_widget_visible',
            value: true,
            tab_specific: true,
          });
        }
      }
      await BG.exec('Cache.set', {
        name: 'recaptcha_widget_visible',
        value: false,
        tab_specific: true,
      });
    }
    return false;
  }

  let was_solved = false;
  let was_incorrect = false;
  let solved_urls = [];

  while (true) {
    await Time.sleep(1000);
    if (!chrome.runtime?.id) {
      continue;
    }

    let settings = await chrome.storage.local.get(null);

    // await check_image_frame_visibility();
    // await check_widget_frame_visibility();

    if (is_widget_frame() && settings.auto_open) {
      await on_widget_frame();
    } else if (is_image_frame() && settings.auto_solve) {
      await on_image_frame(settings);
    }
  }
})();
