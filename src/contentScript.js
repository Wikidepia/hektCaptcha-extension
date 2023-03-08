'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

const Jimp = require('jimp');
const ort = require('onnxruntime-web');

const extension_id = chrome.runtime.id;

// Modify ort wasm path
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': `chrome-extension://${extension_id}/dist/ort-wasm.wasm`,
  'ort-wasm-threaded.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-threaded.wasm`,
  'ort-wasm-simd.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-simd.wasm`,
  'ort-wasm-simd-threaded.wasm': `chrome-extension://${extension_id}/dist/ort-wasm-simd-threaded.wasm`,
};

class Time {
  static sleep(i = 1000) {
    return new Promise((resolve) => setTimeout(resolve, i));
  }

  static async random_sleep(min, max) {
    const duration = Math.floor(Math.random() * (max - min) + min);
    return await Time.sleep(duration);
  }
}

function imageDataToTensor(image, dims) {
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
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let i = 0; i < float32Data.length; i++) {
    float32Data[i] = (float32Data[i] - mean[i % 3]) / std[i % 3];
  }

  // 6. Create a tensor from the float32 data
  const inputTensor = new ort.Tensor('float32', float32Data, dims);
  return inputTensor;
}

(async () => {
  function is_widget_frame() {
    if (
      document.body.getBoundingClientRect()?.width === 0 ||
      document.body.getBoundingClientRect()?.height === 0
    ) {
      return false;
    }
    return document.querySelector('div.check') !== null;
  }

  function is_image_frame() {
    return document.querySelector('h2.prompt-text') !== null;
  }

  function open_image_frame() {
    document.querySelector('#checkbox')?.click();
  }

  function is_solved() {
    const is_widget_frame_solved =
      document.querySelector('div.check')?.style['display'] === 'block';
    return is_widget_frame_solved;
  }

  function get_image_url($e) {
    const matches = $e?.style['background']?.trim()?.match(/(?!^)".*?"/g);
    if (!matches || matches.length === 0) {
      return null;
    }
    return matches[0].replaceAll('"', '');
  }

  async function get_task() {
    let task = document
      .querySelector('h2.prompt-text')
      ?.innerText?.replace(/\s+/g, ' ')
      ?.trim();
    if (!task) {
      return null;
    }

    const CODE = {
      '0430': 'a',
      '0441': 'c',
      '0501': 'd',
      '0065': 'e',
      '0435': 'e',
      '04bb': 'h',
      '0069': 'i',
      '0456': 'i',
      '0458': 'j',
      '03f3': 'j',
      '04cf': 'l',
      '03bf': 'o',
      '043e': 'o',
      '0440': 'p',
      '0455': 's',
      '0445': 'x',
      '0443': 'y',
      '0335': '-',
    };

    function pad_left(s, char, n) {
      while (`${s}`.length < n) {
        s = `${char}${s}`;
      }
      return s;
    }

    const new_task = [];
    for (const e of task) {
      const k = pad_left(e.charCodeAt(0).toString(16), '0', 4);
      if (k in CODE) {
        new_task.push(CODE[k]);
      } else {
        new_task.push(e);
      }
    }
    return new_task.join('');
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

        let task = await get_task();
        if (!task) {
          checking = false;
          return;
        }

        const $cells = document.querySelectorAll('.task-image');
        if ($cells.length !== 9) {
          checking = false;
          return;
        }

        const cells = [];
        const urls = [];
        for (const $e of $cells) {
          const $img = $e.querySelector('div.image');
          if (!$img) {
            checking = false;
            return;
          }

          const url = get_image_url($img);
          if (!url || url === '') {
            checking = false;
            return;
          }

          cells.push($e);
          urls.push(url);
        }

        const urls_hash = JSON.stringify(urls);
        if (last_urls_hash === urls_hash) {
          checking = false;
          return;
        }
        last_urls_hash = urls_hash;

        clearInterval(check_interval);
        checking = false;
        return resolve({
          task,
          cells,
          urls,
        });
      }, i);
    });
  }

  function submit() {
    try {
      document.querySelector('.button-submit').click();
    } catch (e) {
      console.error('error submitting', e);
    }
  }

  function retry() {
    try {
      document.querySelector('.refresh.button').click();
    } catch (e) {
      console.error('error retrying', e);
    }
  }

  function is_cell_selected($cell) {
    return $cell.getAttribute('aria-pressed') === 'true';
  }

  async function on_widget_frame() {
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
    if (
      document.querySelector('.display-language .text').textContent !== 'EN'
    ) {
      document
        .querySelector('.language-selector .option:nth-child(23)')
        .click();
      await Time.sleep(500);
    }

    const { task, cells, urls } = await on_task_ready();

    // shuffle cells and urls with the same order
    const randomIndexes = Array.from({ length: 9 }, (_, i) => i).sort(
      () => Math.random() - 0.5
    );
    const randomUrls = randomIndexes.map((i) => urls[i]);
    const randomCells = randomIndexes.map((i) => cells[i]);

    const featSession = await ort.InferenceSession.create(
      `chrome-extension://${extension_id}/models/mobilenetv3.ort`
    );

    // Get label for image
    const label = task
      .replace('Please click each image containing', '')
      .replace('Please click on all images containing', '')
      .replace('Please click on all images of', '')
      .trim()
      .replace(/^(a|an)\s+/i, '')
      .replace(/\s+/g, '_')
      .toLowerCase();

    chrome.runtime.sendMessage(label, async function (response) {
      if (response.status !== 200) {
        console.log('error getting model', response, label);
        return retry();
      }
      const model = await fetch(response.model);
      const arrayBuffer = await model.arrayBuffer();
      const classifierSession = await ort.InferenceSession.create(arrayBuffer);

      // Solve task
      for (let i = 0; i < randomUrls.length; i++) {
        // Read image from URL
        const image = await Jimp.default.read(randomUrls[i]);

        // Resize image to 224x224 with bilinear interpolation
        image.resize(224, 224, Jimp.RESIZE_BILINEAR);

        // Convert image data to tensor
        const input = imageDataToTensor(image, [1, 3, 224, 224]);

        // Feed input tensor to feature extractor model and run it
        const featOutputs = await featSession.run({ input: input });
        const feats = featOutputs[featSession.outputNames[0]];

        // Feed feats to classifier
        const classifierOutputs = await classifierSession.run({ input: feats });
        const output = classifierOutputs[classifierSession.outputNames[0]].data;

        // Find index of maximum value in output array
        const argmaxValue = output.indexOf(Math.max(...output));

        // If index is 0, click on cell (if it is not already selected)
        if (argmaxValue === 1) {
          if (!is_cell_selected(randomCells[i])) {
            randomCells[i].click();
            await Time.sleep(settings.click_delay_time);
          }
        }
      }

      await Time.sleep(settings.solve_delay_time);
      submit();
    });
  }

  let was_solved = false;
  while (true) {
    await Time.sleep(1000);
    if (!chrome.runtime?.id) {
      continue;
    }

    let settings = await chrome.storage.local.get(null);
    if (is_widget_frame() && settings.auto_open) {
      await on_widget_frame();
    } else if (is_image_frame() && settings.auto_solve) {
      await on_image_frame(settings);
    }
  }
})();
