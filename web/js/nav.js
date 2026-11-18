/* 页面切换：衣柜 / 搭配库 / 搭配编辑 / 衣服详情，用 hash 记录位置。 */
(function (App) {
  'use strict';

  const PAGES = ['page-wardrobe', 'page-outfits', 'page-outfit', 'page-garment'];
  let ready = false;

  function showPage(pageId) {
    PAGES.forEach((id) => {
      document.getElementById(id).hidden = id !== pageId;
    });
    document
      .getElementById('nav-wardrobe')
      .classList.toggle('is-active', pageId === 'page-wardrobe' || pageId === 'page-garment');
    document
      .getElementById('nav-outfits')
      .classList.toggle('is-active', pageId === 'page-outfits' || pageId === 'page-outfit');
  }

  function navigate(hash) {
    if (location.hash === hash) {
      handleRoute();
    } else {
      location.hash = hash;
    }
  }

  function toWardrobe() {
    navigate('#wardrobe');
  }

  function toOutfits() {
    navigate('#outfits');
  }

  function toOutfit(id) {
    navigate(`#outfit/${id}`);
  }

  function toGarment(id) {
    navigate(`#garment/${id}`);
  }

  function handleRoute() {
    if (!ready) return;
    const hash = location.hash || '#wardrobe';
    let match;

    if ((match = hash.match(/^#garment\/(\d+)$/))) {
      showPage('page-garment');
      App.detail.load(Number(match[1]));
      return;
    }
    if ((match = hash.match(/^#outfit\/(\d+)$/))) {
      showPage('page-outfit');
      App.outfitEditor.load(Number(match[1]));
      return;
    }
    if (hash === '#outfits') {
      showPage('page-outfits');
      App.outfits.load();
      return;
    }
    showPage('page-wardrobe');
  }

  function init() {
    document.getElementById('nav-wardrobe').addEventListener('click', toWardrobe);
    document.getElementById('nav-outfits').addEventListener('click', toOutfits);
    window.addEventListener('hashchange', handleRoute);
    ready = true;
  }

  App.nav = { init, toWardrobe, toOutfits, toOutfit, toGarment, handleRoute };
})(window.App = window.App || {});
