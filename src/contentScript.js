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
    "ort-wasm.wasm": `chrome-extension://${extension_id}/dist/ort-wasm.wasm`,
    "ort-wasm-threaded.wasm": `chrome-extension://${extension_id}/dist/ort-wasm-threaded.wasm`,
    "ort-wasm-simd.wasm": `chrome-extension://${extension_id}/dist/ort-wasm-simd.wasm`,
    "ort-wasm-simd-threaded.wasm": `chrome-extension://${extension_id}/dist/ort-wasm-simd-threaded.wasm`,
};

class Time {
    static sleep(i = 1000) {
        return new Promise(resolve => setTimeout(resolve, i));
    }

    static async random_sleep(min, max) {
        const duration = Math.floor(Math.random() * (max - min) + min);
        return await Time.sleep(duration);
    }
}

function imageDataToTensor(image, dims) {
    // 1. Get buffer data from image and create R, G, and B arrays.
    var imageBufferData = image.bitmap.data;
    const [redArray, greenArray, blueArray] = [
        [],
        [],
        []
    ];

    // 2. Loop through the image buffer and extract the R, G, and B channels
    for (let i = 0; i < imageBufferData.length; i += 4) {
        redArray.push(imageBufferData[i]);
        greenArray.push(imageBufferData[i + 1]);
        blueArray.push(imageBufferData[i + 2]);
        // skip data[i + 3] to filter out the alpha channel
    }

    // 3. Concatenate RGB to transpose [224, 224, 3] -> [3, 224, 224] to a number array
    const transposedData = redArray.concat(greenArray)
        .concat(blueArray);

    // 4. convert to float32
    let i, l = transposedData.length; // length, we need this for the loop
    // create the Float32Array size 3 * 224 * 224 for these dimensions output
    const float32Data = new Float32Array(dims[1] * dims[2] * dims[3]);
    for (i = 0; i < l; i++) {
        float32Data[i] = transposedData[i] / 255.0; // convert to float
    }
    // 5. create the tensor object from onnxruntime-web.
    const inputTensor = new ort.Tensor("float32", float32Data, dims);
    return inputTensor;
}

(async () => {
    function is_widget_frame() {
        if (document.body.getBoundingClientRect()
            ?.width === 0 || document.body.getBoundingClientRect()
            ?.height === 0) {
            return false;
        }
        return document.querySelector('div.check') !== null;
    }

    function is_image_frame() {
        return document.querySelector('h2.prompt-text') !== null;
    }

    function open_image_frame() {
        document.querySelector('#checkbox')
            ?.click();
    }

    function is_solved() {
        const is_widget_frame_solved = document.querySelector('div.check')
            ?.style['display'] === 'block';
        return is_widget_frame_solved;
    }

    function get_image_url($e) {
        const matches = $e?.style['background']?.trim()
            ?.match(/(?!^)".*?"/g);
        if (!matches || matches.length === 0) {
            return null;
        }
        return matches[0].replaceAll('"', '');
    }

    async function get_task() {
        let task = document.querySelector('h2.prompt-text')
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
            const k = pad_left(e.charCodeAt(0)
                .toString(16), '0', 4);
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
        return new Promise(resolve => {
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
                    urls
                });
            }, i);
        });
    }

    function submit() {
        try {
            document.querySelector('.button-submit')
                .click();
        } catch (e) {
            console.error('error submitting', e);
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

    async function on_image_frame() {
        if (document.querySelector('.display-language .text').textContent !== 'EN') {
            document.querySelector('.language-selector .option:nth-child(23)').click();
            await Time.sleep(500);
        }

        const {
            task,
            cells,
            urls
        } = await on_task_ready();


        // Get label for image
        const label = task
            .replace('Please click each image containing ', '')
            .replace(/^a /gm, '')
            .replaceAll(' ', '_');

        // Load model with name matching label
        const session = await ort.InferenceSession.create(
            `chrome-extension://${extension_id}/models/${label}.onnx`
        );

        // Solve task
        for (let i = 0; i < urls.length; i++) {
            // Read image from URL
            const image = await Jimp.default.read(urls[i]);

            // Resize image to 64x64
            image.resize(64, 64);

            // Convert image data to tensor
            const input = imageDataToTensor(image, [1, 3, 64, 64]);

            // Feed input tensor to model and run it
            const feeds = {
                'input.1': input,
            };
            const outputs = await session.run(feeds);
            const output = outputs[session.outputNames[0]].data;

            // Find index of maximum value in output array
            const argmaxValue = output.indexOf(Math.max(...output));

            // If index is 0, click on cell (if it is not already selected)
            if (argmaxValue === 0) {
                if (!is_cell_selected(cells[i])) {
                cells[i].click();
                }
            }
        }
        // let delay = parseInt(settings.hcaptcha_solve_delay_time);
        // delay = delay ? delay : 3000;
        // const delta = settings.hcaptcha_solve_delay ? (delay - (Time.time() - solve_start)) : 0;
        // if (delta > 0) {
        //     await Time.sleep(delta);
        // }

        await Time.sleep(200);
        submit();
    }


    let was_solved = false;
    while (true) {
        await Time.sleep(1000);
        if (is_widget_frame()) {
            await on_widget_frame();
        } else if (is_image_frame()) {
            await on_image_frame();
        }
    }
})();
