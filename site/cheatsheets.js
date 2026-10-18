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

  function bindCopy() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
      button.addEventListener('click', function () {
        var code = button.parentNode.querySelector('code');
        if (!code || !navigator.clipboard) return;
        navigator.clipboard.writeText(code.textContent).then(function () {
          button.textContent = 'Copied';
          setTimeout(function () { button.textContent = 'Copy'; }, 1400);
        }, function () {});
      });
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function bindSearch() {
    var input = document.getElementById('cs-q');
    if (!input) return;
    var list = document.querySelector('.cs-results');
    var count = document.querySelector('.cs-search-count');
    var entries = null;
    var loading = null;

    function load() {
      if (!loading) {
        loading = fetch(input.getAttribute('data-index')).then(function (response) {
          return response.json();
        }).then(function (phases) {
          entries = [];
          phases.forEach(function (phase) {
            entries.push({ phase: phase, title: phase.t, href: phase.u, meta: 'Phase ' + phase.n + ' sheet', text: (phase.t + ' phase ' + phase.n).toLowerCase() });
            phase.l.forEach(function (lesson) {
              entries.push({ phase: phase, title: lesson[1], href: phase.u + '/' + lesson[2], meta: 'Phase ' + phase.n + ' · Lesson ' + lesson[0] + (lesson[3] ? ' · ' + (lesson[3].length > 140 ? lesson[3].slice(0, lesson[3].lastIndexOf(', ', 140)) + ', …' : lesson[3]) : ''), text: (lesson[1] + ' ' + lesson[3] + ' ' + phase.t).toLowerCase() });
            });
          });
          return entries;
        }).catch(function () {
          loading = null;
          return [];
        });
      }
      return loading;
    }

    function render() {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!words.length || !entries) {
        list.hidden = true;
        count.textContent = '';
        return;
      }
      var found = entries.filter(function (entry) {
        return words.every(function (word) { return entry.text.indexOf(word) >= 0; });
      });
      found.slice(0, 40).forEach(function (entry) {
        var item = element('li');
        var link = element('a');
        link.href = entry.href;
        var glyph = element('span', 'cs-glyph', entry.phase.g);
        glyph.style.setProperty('--h', entry.phase.h);
        link.style.setProperty('--h', entry.phase.h);
        link.appendChild(glyph);
        link.appendChild(element('b', '', entry.title));
        link.appendChild(element('small', '', entry.meta));
        item.appendChild(link);
        list.appendChild(item);
      });
      list.hidden = !found.length;
      count.textContent = found.length ? found.length + (found.length === 1 ? ' match' : ' matches') + (found.length > 40 ? ', first 40 shown' : '') : 'No match. Try a shorter word.';
    }

    input.addEventListener('focus', load);
    input.addEventListener('input', function () {
      load().then(render);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var first = list.querySelector('a');
      if (first) window.location.href = first.href;
    });
  }

  function start() {
    bindPrint();
    bindCopy();
    bindSearch();
    renderMath();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
