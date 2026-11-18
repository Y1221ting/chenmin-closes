/* 搭配库：搭配列表、新建、删除。 */
(function (App) {
  'use strict';

  const state = { items: [] };
  const els = {};

  function cache() {
    els.grid = document.getElementById('outfit-grid');
    els.empty = document.getElementById('outfit-empty');
    els.count = document.getElementById('outfit-count');
  }

  function sceneText(outfit) {
    return outfit.scenes && outfit.scenes.length ? outfit.scenes.join(' / ') : '未分类';
  }

  function card(outfit) {
    const el = document.createElement('article');
    el.className = 'card outfit-card';
    el.dataset.id = outfit.id;

    const cover = outfit.cover
      ? `<img src="/data/${App.ui.escapeHtml(outfit.cover)}" alt="${App.ui.escapeHtml(outfit.name)}" loading="lazy">`
      : '<span class="card__placeholder">空搭配</span>';

    el.innerHTML = `
      <button class="card__delete" type="button" title="删除">✕</button>
      <div class="card__media outfit-card__cover">${cover}</div>
      <div class="card__body">
        <p class="card__name">${App.ui.escapeHtml(outfit.name)}</p>
        <p class="card__meta">${outfit.item_count} 件 · ${App.ui.escapeHtml(sceneText(outfit))}</p>
      </div>
    `;

    el.addEventListener('click', () => App.nav.toOutfit(outfit.id));
    el.querySelector('.card__delete').addEventListener('click', (event) => {
      handleDelete(event, outfit, el);
    });
    return el;
  }

  async function handleDelete(event, outfit, cardEl) {
    event.stopPropagation();
    const button = cardEl.querySelector('.card__delete');

    if (!cardEl.classList.contains('is-confirming')) {
      cardEl.classList.add('is-confirming');
      button.textContent = '确认删除';
      setTimeout(() => {
        if (cardEl.isConnected) {
          cardEl.classList.remove('is-confirming');
          button.textContent = '✕';
        }
      }, 3000);
      return;
    }

    try {
      await App.api.del(`/api/outfits/${outfit.id}`);
      App.ui.toast('已删除搭配');
      load();
    } catch (err) {
      App.ui.toast(err.message, 'error');
    }
  }

  function render() {
    els.grid.innerHTML = '';
    const items = state.items;

    els.count.textContent = items.length ? `${items.length} 套搭配` : '还没有搭配';
    els.grid.hidden = items.length === 0;
    els.empty.hidden = items.length > 0;

    items.forEach((outfit, index) => {
      const el = card(outfit);
      el.style.animationDelay = `${Math.min(index, 12) * 24}ms`;
      els.grid.appendChild(el);
    });
  }

  async function load() {
    try {
      state.items = await App.api.get('/api/outfits');
      render();
    } catch (err) {
      App.ui.toast(err.message, 'error');
    }
  }

  async function create() {
    try {
      const outfit = await App.api.post('/api/outfits', {
        name: '未命名搭配',
        scenes: [],
      });
      App.nav.toOutfit(outfit.id);
    } catch (err) {
      App.ui.toast(err.message, 'error');
    }
  }

  function init() {
    cache();
    document.getElementById('btn-new-outfit').addEventListener('click', create);
    document.getElementById('btn-new-outfit-empty').addEventListener('click', create);
    load();
  }

  App.outfits = { init, load };
})(window.App = window.App || {});
