'use strict';

export class Time {
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

export class KVStorage {
  // KVStorage by sending messages to background script
  static async get({ key, tab_specific }) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'KV_GET', label: { key, tab_specific } },
        (response) => {
          if (response) {
            resolve(response);
          } else {
            reject();
          }
        }
      );
    });
  }
  static async set({ key, value, tab_specific }) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'KV_SET', label: { key, value, tab_specific } },
        (response) => {
          if (response) {
            resolve(response);
          } else {
            reject();
          }
        }
      );
    });
  }
}
