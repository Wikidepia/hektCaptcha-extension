'use strict';

const { merge } = require('webpack-merge');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

const common = require('./webpack.common.js');
const ManifestPlugin = require('./manifest.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      popup: PATHS.src + '/popup.js',
      setup: PATHS.src + '/setup.js',
      background: PATHS.src + '/background.js',
      hcaptcha: PATHS.src + '/hcaptcha.js',
      recaptcha: PATHS.src + '/recaptcha.js',
      'recaptcha-visibility': PATHS.src + '/recaptcha-visibility.js',
    },
    resolve: {
      fallback: {
        zlib: require.resolve('browserify-zlib'),
        util: require.resolve('util/'),
        assert: require.resolve('assert/'),
        stream: require.resolve('stream-browserify'),
        querystring: require.resolve('querystring-es3/'),
        url: require.resolve('url/'),
        https: require.resolve('http-browserify'),
        http: require.resolve('stream-http'),
        path: require.resolve('path-browserify'),
        buffer: require.resolve('buffer'),
        fs: false,
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new webpack.ProvidePlugin({
        process: 'process/browser',
      }),
      new ManifestPlugin({
        browser: env.browser,
      }),
    ],
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              unused: false,
            },
          },
        }),
      ],
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
