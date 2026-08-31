/**
 * Best-effort: Instagram's DOM changes often. This only hides obvious
 * "Open in app" / store intercepts so the WebView is not yanked into the
 * Instagram app.
 */
export const HIDE_APP_INTERSTITIAL_SCRIPT = `
(function () {
  function hide() {
    try {
      var nodes = document.querySelectorAll('a, button');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var href = (el.getAttribute && el.getAttribute('href')) || '';
        var text = ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).toLowerCase();
        var isAppLink =
          href.indexOf('instagram://') === 0 ||
          href.indexOf('itms-apps://') === 0 ||
          href.indexOf('intent://') === 0 ||
          text.indexOf('open in app') !== -1 ||
          text.indexOf('use the app') !== -1 ||
          text.indexOf('open instagram') !== -1;
        if (!isAppLink) continue;
        var bar = el.closest && el.closest('[role="dialog"], [role="banner"], header');
        var target = bar || el.parentElement;
        if (target && target !== document.body && target !== document.documentElement) {
          target.style.setProperty('display', 'none', 'important');
        }
      }
    } catch (e) {}
  }
  hide();
  try {
    new MutationObserver(hide).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (e) {}
})();
true;
`;

/**
 * Instagram is an SPA. Top-frame URL changes via history.pushState often skip
 * onShouldStartLoadWithRequest — post them to native so the allowlist still runs.
 */
export const SPA_NAV_WATCHER_SCRIPT = `
(function () {
  function post() {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'nav', url: String(location.href) })
        );
      }
    } catch (e) {}
  }
  function wrap(fn) {
    return function () {
      var ret = fn.apply(this, arguments);
      post();
      return ret;
    };
  }
  try {
    history.pushState = wrap(history.pushState.bind(history));
    history.replaceState = wrap(history.replaceState.bind(history));
    window.addEventListener('popstate', post);
    window.addEventListener('hashchange', post);
  } catch (e) {}
})();
true;
`;

/**
 * Instagram focuses the DM composer when you open a Reel in a thread, which
 * pops the iOS keyboard. Only keep focus if the user actually touched a
 * text field (typing a reply). Login pages are left alone.
 */
export const KEYBOARD_GUARD_SCRIPT = `
(function () {
  var lastTouch = null;
  var lastTouchAt = 0;

  function inDms() {
    var path = location.pathname || '';
    return path.indexOf('/direct') === 0
      || path.indexOf('/reel') === 0
      || path.indexOf('/p/') === 0
      || path.indexOf('/stories') === 0;
  }

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      return type !== 'button' && type !== 'submit' && type !== 'checkbox'
        && type !== 'radio' && type !== 'file' && type !== 'hidden' && type !== 'range';
    }
    if (el.isContentEditable) return true;
    return !!(el.closest && el.closest(
      'textarea, [contenteditable="true"], [contenteditable=""], input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])'
    ));
  }

  function recordTouch(e) {
    lastTouch = e.target;
    lastTouchAt = Date.now();
    if (inDms() && !isEditable(e.target)) {
      [50, 200, 500, 1000].forEach(function (ms) {
        setTimeout(function () {
          blurIfUnwanted(document.activeElement);
        }, ms);
      });
    }
  }

  function blurIfUnwanted(focused) {
    if (!inDms() || !isEditable(focused)) return;
    var recent = Date.now() - lastTouchAt < 1500;
    var tappedField = recent && lastTouch && (
      isEditable(lastTouch)
      || (focused.contains && focused.contains(lastTouch))
      || lastTouch === focused
    );
    if (tappedField) return;
    try { focused.blur(); } catch (err) {}
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'dismiss-keyboard' }));
      }
    } catch (err) {}
  }

  document.addEventListener('touchstart', recordTouch, true);
  document.addEventListener('mousedown', recordTouch, true);
  document.addEventListener('focusin', function (e) {
    blurIfUnwanted(e.target);
  }, true);
})();
true;
`;

