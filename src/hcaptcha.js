'use strict';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts

import 'jimp';
import { Time } from './utils';
const ort = require('onnxruntime-web');

// Modify ort wasm path
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': chrome.runtime.getURL('dist/ort-wasm.wasm'),
  'ort-wasm-threaded.wasm': chrome.runtime.getURL(
    'dist/ort-wasm-threaded.wasm'
  ),
  'ort-wasm-simd.wasm': chrome.runtime.getURL('dist/ort-wasm-simd.wasm'),
  'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL(
    'dist/ort-wasm-simd-threaded.wasm'
  ),
};

async function letterboxImage(image, size) {
  const iw = image.bitmap.width;
  const ih = image.bitmap.height;
  const [w, h] = size;
  const scale = Math.min(w / iw, h / ih);
  const nw = Math.floor(iw * scale);
  const nh = Math.floor(ih * scale);

  image = await image.resize(nw, nh, Jimp.RESIZE_BICUBIC);
  const newImage = new Jimp(w, h, 0x727272ff);
  newImage.composite(image, (w - nw) / 2, (h - nh) / 2);
  return newImage;
}

function scaleBoxes(boxes, imageDims, scaledDims) {
  const gain = Math.min(
    scaledDims[0] / imageDims[0],
    scaledDims[1] / imageDims[1]
  );
  const wPad = (scaledDims[0] - gain * imageDims[0]) / 2;
  const hPad = (scaledDims[1] - gain * imageDims[1]) / 2;
  return boxes.map((box, i) => (box - (i % 2 === 0 ? wPad : hPad)) / gain);
}

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

  // 3. Concatenate RGB to transpose [256, 256, 3] -> [3, 256, 256] to a number array
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

function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((acc, val, i) => acc + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((acc, val) => acc + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((acc, val) => acc + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function softmax(x) {
  const e_x = x.map((v) => Math.exp(v));
  const sum_e_x = e_x.reduce((a, b) => a + b, 0);
  return e_x.map((v) => v / sum_e_x);
}

async function classifyImage(featSession, classifierSession, url) {
  // Read image from URL
  const image = await Jimp.read(url);

  // Resize image to 256x256 with bilinear interpolation
  image.resize(256, 256, Jimp.RESIZE_BILINEAR);

  // Convert image data to tensor
  const input = imageDataToTensor(image, [1, 3, 256, 256]);

  // Feed input tensor to feature extractor model and run it
  const featOutputs = await featSession.run({ input: input });
  const feats = featOutputs[featSession.outputNames[0]];

  // Feed feats to classifier
  const classifierOutputs = await classifierSession.run({
    input: feats,
  });
  return classifierOutputs[classifierSession.outputNames[0]].data;
}

function simulateMouseClick(element, clientX = null, clientY = null) {
  if (clientX === null || clientY === null) {
    const box = element.getBoundingClientRect();
    clientX = box.left + box.width / 2;
    clientY = box.top + box.height / 2;
  }

  if (isNaN(clientX) || isNaN(clientY)) {
    return;
  }

  // Send mouseover, mousedown, mouseup, click, mouseout
  const eventNames = [
    'mouseover',
    'mouseenter',
    'mousedown',
    'mouseup',
    'click',
    'mouseout',
  ];
  eventNames.forEach((eventName) => {
    const detail = eventName === 'mouseover' ? 0 : 1;
    const event = new MouseEvent(eventName, {
      detail: detail,
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: clientX,
      clientY: clientY,
    });
    element.dispatchEvent(event);
  });
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
    simulateMouseClick(document.querySelector('#anchor'));
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

  let afterRefresh = false;
  let lastUrls = null;
  function on_task_ready(settings, i = 500) {
    let cnt = 0;
    return new Promise((resolve) => {
      let checking = false;
      const check_interval = setInterval(async () => {
        if (checking) {
          return;
        }
        checking = true;

        // Wait for delay reload time
        cnt += 1;
        if (settings.hcaptcha_reload_delay_time / i > cnt && afterRefresh) {
          checking = false;
          return;
        }

        let task = await get_task();
        if (!task) {
          checking = false;
          return;
        }

        // Determine hCaptcha type
        let type = null;
        if (document.querySelector('.challenge-view > .task-grid')) {
          type = 'CLASSIFY';
        } else if (document.querySelector('.challenge-view > .task-wrapper')) {
          type = 'MULTI_CHOICE';
        } else if (
          document.querySelector('.challenge-view > .bounding-box-example')
        ) {
          type = 'BOUNDING_BOX';
        }

        const cells = [];
        const urls = [];
        // Get image URLs and cells
        if (type === 'CLASSIFY') {
          const $cells = document.querySelectorAll('.task-image');

          if ($cells.length === 0) {
            checking = false;
            return;
          }

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
        } else if (type === 'MULTI_CHOICE') {
          const $task = document.querySelector('.task-image');
          const $answers = document.querySelectorAll('.challenge-answer');

          if ($answers.length === 0) {
            checking = false;
            return;
          }

          const $img = $task.querySelector('div.image');
          if (!$img) {
            checking = false;
            return;
          }

          const url = get_image_url($img);
          if (!url || url === '') {
            checking = false;
            return;
          }

          urls.push(url);
          cells.push(...$answers);
        } else if (type === 'BOUNDING_BOX') {
          const $canvas = document.querySelector('.challenge-view > canvas');
          if (!$canvas) {
            checking = false;
            return;
          }

          cells.push($canvas);
          urls.push($canvas.toDataURL('image/jpeg'));
        }

        const currentUrls = JSON.stringify(urls);
        if (lastUrls === currentUrls) {
          checking = false;
          return;
        }
        lastUrls = currentUrls;

        // Get specific class based on task
        const fetchClass = await fetch(
          `https://hekt-static.akmal.dev/speclass.json`
        );
        if (fetchClass.status === 200) {
          const classJSON = await fetchClass.json();
          type = classJSON[task] || type;
        }

        clearInterval(check_interval);
        checking = false;
        afterRefresh = false;
        return resolve({
          task,
          type,
          cells,
          urls,
        });
      }, i);
    });
  }

  function submit() {
    try {
      simulateMouseClick(document.querySelector('.button-submit'));
    } catch (e) {
      console.error('error submitting', e);
    }
  }

  async function refresh() {
    try {
      afterRefresh = true;
      simulateMouseClick(document.querySelector('.refresh.button'));
      await Time.sleep(250);
    } catch (e) {
      console.error('error refreshing', e);
    }
  }

  function is_cell_selected($cell) {
    return $cell.getAttribute('aria-pressed') === 'true';
  }

  async function on_widget_frame() {
    // Wait if already solved
    if (is_solved()) {
      return;
    }
    await Time.sleep(500);
    open_image_frame();
  }

  async function on_image_frame(settings) {
    if (
      document.querySelector('.display-language .text').textContent !== 'EN'
    ) {
      simulateMouseClick(
        document.querySelector('.language-selector .option:nth-child(23)')
      );
      await Time.sleep(500);
    }

    const { task, type, cells, urls } = await on_task_ready(settings);

    const featSession = await ort.InferenceSession.create(
      chrome.runtime.getURL('models/mobileone-s0.ort')
    );

    // Usual 3x3 grid, classify
    if (type == 'CLASSIFY') {
      // Get label for image
      const label = task
        .replace('Please click on each image containing', '')
        .replace('Please click each image containing', '')
        .replace('Please click on all images containing', '')
        .replace('Please click on all images of', '')
        .replace('Please click on the', '')
        .replace('Select all images containing', '')
        .replace('Select all', '')
        .trim()
        .replace(/^(a|an)\s+/i, '')
        .replace(/^the\s+/i, '')
        .replace(/'|\./g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();

      const modelURL = `https://hekt-static.akmal.dev/classify/${label}.ort`;
      const fetchModel = await fetch(modelURL);

      if (fetchModel.status !== 200) {
        console.log('error getting model', fetchModel, label);
        return await refresh();
      }

      const modelBuffer = await fetchModel.arrayBuffer();
      const classifierSession = await ort.InferenceSession.create(
        Buffer.from(modelBuffer)
      );

      // Solve task
      for (let i = 0; i < urls.length; i++) {
        if (!cells[i].isConnected) {
          return;
        }

        // Find index of maximum value in output array
        const output = await classifyImage(
          featSession,
          classifierSession,
          urls[i]
        );
        const argmaxValue = output.indexOf(Math.max(...output));

        // If argmaxValue is 1, click on cell (if it is not already selected)
        if (argmaxValue === 1 && !is_cell_selected(cells[i])) {
          await Time.sleep(settings.hcaptcha_click_delay_time);
          simulateMouseClick(cells[i]);
        }
      }

      if (cells[0].isConnected) {
        await Time.sleep(settings.hcaptcha_solve_delay_time);
        return submit();
      }
    }
    // 1x3 grid, multi choice (similar image)
    else if (type == 'MULTI_CHOICE') {
      // Read main image from URL
      const image = await Jimp.read(urls[0]);

      // Resize image to 256x256 with bilinear interpolation
      image.resize(256, 256, Jimp.RESIZE_BILINEAR);

      // Convert image data to tensor
      const input = imageDataToTensor(image, [1, 3, 256, 256]);

      // Feed input tensor to feature extractor model and run it
      const featOutputs = await featSession.run({ input: input });
      const feats = featOutputs[featSession.outputNames[0]];

      const outputs = [];
      for (let i = 0; i < cells.length; i++) {
        const label = cells[i]
          .querySelector('.answer-text')
          .textContent.replace(/\s+/g, '_')
          .toLowerCase();
        const modelURL = `https://hekt-static.akmal.dev/classify/${label}.ort`;
        const fetchModel = await fetch(modelURL);

        if (fetchModel.status !== 200) {
          console.log('error getting model', fetchModel, label);
          return await refresh();
        }

        const modelBuffer = await fetchModel.arrayBuffer();
        const classifierSession = await ort.InferenceSession.create(
          Buffer.from(modelBuffer)
        );
        const classifierOutputs = await classifierSession.run({ input: feats });
        const output = classifierOutputs[classifierSession.outputNames[0]].data;

        const confidence = softmax(output);
        outputs[i] = confidence[1];
      }

      const positiveCell = cells[outputs.indexOf(Math.max(...outputs))];
      // Click highest confidence cell
      if (!is_cell_selected(positiveCell)) {
        await Time.sleep(settings.hcaptcha_solve_delay_time / 2);
        simulateMouseClick(positiveCell);
        await Time.sleep(settings.hcaptcha_solve_delay_time / 2);
        return submit();
      }
    } else if (type == 'BOUNDING_BOX') {
      // Get label for image
      const label = task
        .replace('Please click on the thumbnail that is', '')
        .replace('Please click the center of the')
        .replace('Please click on the', '')
        .replace('Please click the', '')
        .trim()
        .replace(/^(a|an)\s+/i, '')
        .replace(/'|\./g, '')
        .replace(/\s+/g, '_')
        .trim()
        .toLowerCase();

      const modelURL = `https://hekt-static.akmal.dev/bounding_box/${label}.ort`;
      const fetchModel = await fetch(modelURL);

      if (fetchModel.status !== 200) {
        console.log('error getting model', fetchModel, label);
        return await refresh();
      }

      const modelBuffer = await fetchModel.arrayBuffer();
      const session = await ort.InferenceSession.create(
        Buffer.from(modelBuffer)
      );
      const nmsSession = await ort.InferenceSession.create(
        chrome.runtime.getURL('models/nms-yolov5-det.ort')
      );

      const cellWidth = cells[0].getBoundingClientRect().width;
      const cellHeight = cells[0].getBoundingClientRect().height;

      // Get url and remove data:image/png;base64,
      const url = urls[0].split(',')[1];
      // If url size is smaller than 50kb then return empty
      if (url.length < 50 * 1024) {
        return;
      }
      const image = await Jimp.read(Buffer.from(url, 'base64'));
      image.rgba(false);

      // Resize to cell and autocrop
      image.resize(cellWidth, cellHeight, Jimp.RESIZE_BILINEAR); // TODO: skip resize, use scaling factor
      image.autocrop({ cropOnlyFrames: false, cropSymmetric: false });
      const cropWidth = image.getWidth();
      const cropHeight = image.getHeight();

      // [topK, ioUThreshold, scoreThreshold]
      const config = new ort.Tensor(
        'float32',
        new Float32Array([10, 0.25, 0.001])
      );
      const inputImage = await letterboxImage(image, [640, 640]);
      const inputTensor = imageDataToTensor(
        inputImage,
        [1, 3, 640, 640],
        false
      );

      // YOLOv5 detector
      const outputMap = await session.run({ images: inputTensor });
      const output0 = outputMap[session.outputNames[0]];

      // NMS (Non-Maximum Suppression)
      const nmsOutput = await nmsSession.run({
        detection: outputMap[session.outputNames[0]],
        config: config,
      });
      const selectedIdx = nmsOutput[nmsSession.outputNames[0]];

      for (let i = 0; i < selectedIdx.data.length; i++) {
        const idx = selectedIdx.data[i];
        const data = output0.data.slice(
          idx * output0.dims[2],
          (idx + 1) * output0.dims[2]
        );

        const [x, y, w, h] = data.slice(0, 4);
        const [x1, y1, w1, h1] = scaleBoxes(
          [x, y, w, h],
          [cropWidth, cropHeight],
          [640, 640]
        );
        const [x2, y2, x3, y3] = [
          x1 - w1 / 2,
          y1 - h1 / 2,
          x1 + w1 / 2,
          y1 + h1 / 2,
        ];

        // Get middle coordinate of result
        let middleX = (x2 + x3) / 2;
        let middleY = (y2 + y3) / 2;

        // Add offset to middle coordinate
        middleX += cellWidth - cropWidth;
        middleY += cellHeight - cropHeight;

        // Skip if middle coordinate is not in clickable canvas
        // Approximately 10% of the cell
        if (middleX < cellWidth * 0.1 || middleY < cellHeight * 0.1) {
          continue;
        }

        simulateMouseClick(cells[0], middleX, middleY);
        await Time.sleep(settings.hcaptcha_solve_delay_time);
        lastUrls = JSON.stringify([cells[0].toDataURL('image/jpeg')]);
        return submit();
      }
      return await refresh();
    } else if (type == 'NESTED_CLASSIFY') {
      // Get label for image
      const label = task
        .replace('Please click on each image containing', '')
        .replace('Please click each image containing', '')
        .replace('Please click on all images containing', '')
        .replace('Please click on all images of', '')
        .replace('Please click on the', '')
        .replace('Select all images containing', '')
        .replace('Select all', '')
        .trim()
        .replace(/^(a|an)\s+/i, '')
        .replace(/^the\s+/i, '')
        .replace(/'|\./g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();

      const rankURL = `https://hekt-static.akmal.dev/nestclass.json`;
      const fetchRank = await fetch(rankURL);
      if (fetchRank.status !== 200) {
        console.log('error getting rank', fetchRank, label);
        return await refresh();
      }

      const rankJSON = await fetchRank.json();
      const ranks = rankJSON[label];
      if (!ranks) {
        console.log('error getting rank', fetchRank, label);
        return await refresh();
      }

      let labelFound = false;
      for (let i = 0; i < ranks.length; i++) {
        const rankLabel = ranks[i];
        const modelURL = `https://hekt-static.akmal.dev/classify/${rankLabel}.ort`;
        const fetchModel = await fetch(modelURL);

        if (fetchModel.status !== 200) {
          console.log('error getting model', fetchModel, rankLabel);
          return await refresh();
        }

        const modelBuffer = await fetchModel.arrayBuffer();
        const classifierSession = await ort.InferenceSession.create(
          Buffer.from(modelBuffer)
        );

        // Solve task
        for (let i = 0; i < urls.length; i++) {
          if (!cells[i].isConnected) {
            return;
          }

          // Find index of maximum value in output array
          const output = await classifyImage(
            featSession,
            classifierSession,
            urls[i]
          );
          const argmaxValue = output.indexOf(Math.max(...output));

          // If argmaxValue is 1, click on cell (if it is not already selected)
          if (argmaxValue === 1 && !is_cell_selected(cells[i])) {
            labelFound = true;
            await Time.sleep(settings.hcaptcha_click_delay_time);
            simulateMouseClick(cells[i]);
          }
        }

        if (labelFound) {
          await Time.sleep(settings.hcaptcha_solve_delay_time);
          return submit();
        }
      }
    } else {
      return await refresh();
    }
  }

  while (true) {
    await Time.sleep(1000);
    if (!chrome.runtime?.id) {
      continue;
    }

    let settings = await chrome.storage.local.get(null);
    if (is_widget_frame() && settings.hcaptcha_auto_open) {
      await on_widget_frame();
    } else if (is_image_frame() && settings.hcaptcha_auto_solve) {
      await on_image_frame(settings);
    }
  }
})();
