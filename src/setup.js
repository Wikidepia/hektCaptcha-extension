(function () {
  function setup() {
    browser.permissions.request({
      origins: [
        '<all_urls>',
        '*://hekt.akmal.dev/*',
        '*://*.hcaptcha.com/captcha/*',
        '*://*.google.com/recaptcha/*',
        '*://*.recaptcha.net/recaptcha/*',
      ],
    });
  }
  document.getElementById('setup-button').addEventListener('click', setup);
})();
