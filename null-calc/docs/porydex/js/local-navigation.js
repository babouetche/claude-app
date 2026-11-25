/* Keep the official panel navigation usable from file:// and in the calculator. */
(function (root) {
  'use strict';
  var home = new URL('index.html', location.href).href;
  var directory = new URL('./', home).pathname;
  function fragment(value) {
    value = String(value || '');
    if (value.indexOf(home + '#') === 0) return value.slice(home.length + 1);
    if (value.indexOf('#') === 0) return value.slice(1);
    if (value.indexOf(directory) === 0) value = value.slice(directory.length);
    return value.replace(/^\//, '');
  }
  function localize(link) {
    var value = link.getAttribute('href');
    if (value === null) return;
    var route = fragment(value);
    if (route === '' || /^(pokemon|moves|items|abilities|types|egggroups|encounters)(\/|$)/.test(route)) {
      var target = home + '#' + route;
      if (value !== target) link.setAttribute('href', target);
    }
  }
  function rewrite(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('a[data-target], a.pfx-go-left, a.pfx-go-right')) localize(node);
    node.querySelectorAll('a[data-target], a.pfx-go-left, a.pfx-go-right').forEach(localize);
  }
  root.NullDexLocalRoutes = {home: home, fragment: fragment};
  root.__DEX_ROOT = home + '#';
  rewrite(document.body);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      if (record.type === 'attributes') localize(record.target);
      else record.addedNodes.forEach(rewrite);
    });
  }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['href']});
  document.querySelector('.nav a[href="../../CALCULATEUR.html"]').addEventListener('click', function (event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || parent === root) return;
    event.preventDefault();
    // file:// frames can have opaque origins; the parent verifies the sender.
    parent.postMessage({type: 'null-dex-show-calculator'}, '*');
  });
})(window);
