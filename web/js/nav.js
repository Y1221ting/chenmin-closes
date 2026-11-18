/* 页面切换：衣柜 ↔ 衣服详情，用 hash 记录当前位置。 */
(function (App) {
  'use strict';

  function showWardrobe() {
    document.getElementById('page-wardrobe').hidden = false;
    document.getElementById('page-garment').hidden = true;
    document.getElementById('nav-wardrobe').classList.add('is-active');
  }

  function showGarment(id) {
    document.getElementById('page-wardrobe').hidden = true;
    document.getElementById('page-garment').hidden = false;
    App.detail.load(id);
  }

  function toWardrobe() {
    if (location.hash && location.hash !== '#wardrobe') {
      location.hash = '#wardrobe';
    } else {
      showWardrobe();
    }
  }

  function toGarment(id) {
    const hash = `#garment/${id}`;
    if (location.hash !== hash) {
      location.hash = hash;
    } else {
      showGarment(id);
    }
  }

  function handleRoute() {
    const match = location.hash.match(/^#garment\/(\d+)$/);
    if (match) {
      showGarment(Number(match[1]));
    } else {
      showWardrobe();
    }
  }

  window.addEventListener('hashchange', handleRoute);

  App.nav = { toWardrobe, toGarment, handleRoute };
})(window.App = window.App || {});
