// This code comes from SponsorBlock by Ajay Ramachandran
// https://github.com/ajayyy/SponsorBlock/blob/fea33945c7ce7da71cf93cb166de55a0efa2711f/webpack/webpack.manifest.js
// License: LGPL-3.0

const path = require('path');
const { validate } = require('schema-utils');
const fs = require('fs');

const PATHS = require('./paths');
const manifest = require('../public/manifest.json');
const manifestFirefoxExtra = require('../public/manifest.firefox.json');

// schema for options object
const schema = {
  type: 'object',
  properties: {
    browser: {
      type: 'string',
    },
  },
};

class ManifestPlugin {
  constructor(options = {}) {
    validate(schema, options, 'Build Manifest Plugin');

    this.options = options;
  }

  apply() {
    const distManifestFile = path.resolve(PATHS.build, 'manifest.json');

    // Add missing manifest elements
    if (this.options.browser.toLowerCase() === 'firefox') {
      mergeObjects(manifest, manifestFirefoxExtra);
    }

    let result = JSON.stringify(manifest, null, 2);

    fs.mkdirSync(PATHS.build, { recursive: true });
    fs.writeFileSync(distManifestFile, result);
  }
}

function mergeObjects(object1, object2) {
  for (const key in object2) {
    if (key in object1) {
      if (Array.isArray(object1[key])) {
        object1[key] = object1[key].concat(object2[key]);
      } else if (typeof object1[key] == 'object') {
        mergeObjects(object1[key], object2[key]);
      } else {
        object1[key] = object2[key];
      }
    } else {
      object1[key] = object2[key];
    }
  }
}

module.exports = ManifestPlugin;
