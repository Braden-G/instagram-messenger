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
