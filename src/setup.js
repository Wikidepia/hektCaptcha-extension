(function () {
  function setup() {
    browser.permissions.request({
      origins: [
        '*://hekt.akmal.dev/*',
        '*://*.hcaptcha.com/captcha/*',
      ],
    });
  }
  document.getElementById('setup-button').addEventListener('click', setup);
})();
