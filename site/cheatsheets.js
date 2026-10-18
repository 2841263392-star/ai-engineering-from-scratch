(function () {
  'use strict';

  var KATEX_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/';
  var KATEX_JS_SRI = 'sha384-CwjPRVHTvLiMBFjEoij+QZViMV5rhTOIp7CJzl24JEqpRDA1sJFHVXXLURktbYYp';
  var KATEX_CSS_SRI = 'sha384-nH0MfJ44wi1dd7w6jinlyBgljjS8EJAh2JBoRad8a3VDw2K69vfaaqm4WnR+gXtA';
  var root = document.documentElement;

  function done() {
    root.setAttribute('data-math', 'ready');
  }

  function loadKatex() {
    return new Promise(function (resolve, reject) {
      if (window.katex) {
        resolve(window.katex);
        return;
      }
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = KATEX_BASE + 'katex.min.css';
      link.integrity = KATEX_CSS_SRI;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      var script = document.createElement('script');
      script.src = KATEX_BASE + 'katex.min.js';
      script.integrity = KATEX_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        if (window.katex) resolve(window.katex);
        else reject(new Error('katex loaded without defining window.katex'));
      };
      script.onerror = function () {
        reject(new Error('katex failed to load'));
      };
      document.head.appendChild(script);
    });
  }

  function renderMath() {
    var nodes = document.querySelectorAll('.math-inline:not([data-math-rendered]), .math-display:not([data-math-rendered])');
    if (!nodes.length) {
      done();
      return;
    }
    loadKatex().then(function (katex) {
      Array.prototype.forEach.call(nodes, function (node) {
        var tex = node.textContent;
        try {
          katex.render(tex, node, {
            displayMode: node.classList.contains('math-display'),
            throwOnError: true,
            strict: 'ignore',
            trust: false
          });
          node.setAttribute('data-math-rendered', '');
        } catch (error) {
          node.textContent = tex;
          node.setAttribute('title', String(error && error.message || error));
        }
      });
    }).catch(function () {}).then(done);
  }

  function bindPrint() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-print]'), function (button) {
      button.addEventListener('click', function () {
        window.print();
      });
    });
  }

  function start() {
    bindPrint();
    renderMath();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
