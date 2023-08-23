// This code comes from SponsorBlock by Ajay Ramachandran
// https://github.com/ajayyy/SponsorBlock/blob/fea33945c7ce7da71cf93cb166de55a0efa2711f/webpack/webpack.manifest.js
// License: LGPL-3.0

const path = require('path');
const { validate } = require('schema-utils');
const fs = require('fs');

const PATHS = require('./paths');
const manifestChrome = require('../public/manifest.json');
const manifestFirefox = require('../public/manifest.firefox.json');

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

    fs.mkdirSync(PATHS.build, { recursive: true });
    if (this.options.browser.toLowerCase() === 'chrome') {
      fs.writeFileSync(distManifestFile, JSON.stringify(manifestChrome));
    } else if (this.options.browser.toLowerCase() === 'firefox') {
      fs.writeFileSync(distManifestFile, JSON.stringify(manifestFirefox));
    }
  }
}

module.exports = ManifestPlugin;
