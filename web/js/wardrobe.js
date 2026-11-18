/* 衣柜页：分类、颜色、季节、场合筛选 + 名称搜索 + 缩略图网格。 */
(function (App) {
  'use strict';

  const state = {
    meta: null,
    items: [],
    category: '',
    color: '',
    season: '',
    scene: '',
    keyword: '',
    loading: false,
  };

  const els = {};

  function cache() {
    els.grid = document.getElementById('wardrobe-grid');
    els.empty = document.getElementById('empty-state');
    els.filterEmpty = document.getElementById('filter-empty');
    els.count = document.getElementById('wardrobe-count');
    els.categories = document.getElementById('category-filters');
    els.color = document.getElementById('filter-color');
    els.season = document.getElementById('filter-season');
    els.scene = document.getElementById('filter-scene');
    els.clear = document.getElementById('btn-clear-filters');
    els.search = document.getElementById('search-input');
  }

  function labelsOf(key) {
    const map = {};
    (state.meta[key] || []).forEach((opt) => {
      map[opt.value] = opt.label;
    });
    return map;
  }

  function hasFilters() {
    return Boolean(state.category || state.color || state.season || state.scene || state.keyword);
  }

  // ---------------------------------------------------------------- 筛选栏

  function renderCategoryChips() {
    const options = [{ value: '', label: '全部' }].concat(state.meta.categories);
    els.categories.innerHTML = '';

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.category === opt.value ? ' is-active' : '');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        state.category = opt.value;
        renderCategoryChips();
        updateClearButton();
        load();
      });
      els.categories.appendChild(btn);
    });
  }

  function fillSelect(select, options, placeholder) {
    const current = select.value;
    select.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    select.appendChild(empty);

    options.forEach((opt) => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    });

    if (current) {
      select.value = current;
    }
  }

  function updateClearButton() {
    els.clear.hidden = !hasFilters();
  }

  function clearFilters() {
    state.category = '';
    state.color = '';
    state.season = '';
    state.scene = '';
    state.keyword = '';
    els.color.value = '';
    els.season.value = '';
    els.scene.value = '';
    els.search.value = '';
    renderCategoryChips();
    updateClearButton();
    load();
  }

  // ---------------------------------------------------------------- 渲染

  function cardElement(item, index, categoryLabels, colorLabels) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = item.id;
    card.style.animationDelay = `${Math.min(index, 12) * 24}ms`;

    const version = item.updated_at
      ? `?v=${encodeURIComponent(item.updated_at)}`
      : '';
    const media = item.thumb
      ? `<img src="/data/${App.ui.escapeHtml(item.thumb)}${version}" alt="${App.ui.escapeHtml(item.name)}" loading="lazy">`
      : `<span class="card__placeholder">暂无图片<br>${App.ui.escapeHtml(categoryLabels[item.category] || '')}</span>`;

    const meta = [
      categoryLabels[item.category] || '',
      item.color ? colorLabels[item.color] || '' : '',
    ].filter(Boolean).join(' · ');

    card.innerHTML = `
      <button class="card__delete" type="button" title="删除">✕</button>
      <div class="card__media">${media}</div>
      <div class="card__body">
        <p class="card__name">${App.ui.escapeHtml(item.name)}</p>
        <p class="card__meta">${App.ui.escapeHtml(meta)}</p>
      </div>
    `;

    card.addEventListener('click', () => App.nav.toGarment(item.id));
    card.querySelector('.card__delete').addEventListener('click', (event) => {
      handleDelete(event, item);
    });
    return card;
  }

  function render() {
    const categoryLabels = labelsOf('categories');
    const colorLabels = labelsOf('colors');
    const items = state.items;
    const filtered = hasFilters();

    els.grid.innerHTML = '';
    els.grid.hidden = items.length === 0;

    if (items.length > 0) {
      els.count.textContent = filtered ? `筛选出 ${items.length} 件` : `${items.length} 件衣服`;
    } else {
      els.count.textContent = filtered ? '没有符合条件的衣服' : '还没有衣服';
    }

    els.empty.hidden = items.length > 0 || filtered || state.loading;
    els.filterEmpty.hidden = items.length > 0 || !filtered || state.loading;

    items.forEach((item, index) => {
      els.grid.appendChild(cardElement(item, index, categoryLabels, colorLabels));
    });
  }

  async function handleDelete(event, item) {
    event.stopPropagation();

    const confirmed = await App.ui.confirm({
      title: `删除「${item.name}」？`,
      message: '这件衣服的三张角度图也会一起删除，无法恢复。',
      confirmText: '删除',
    });
    if (!confirmed) return;

    try {
      await App.api.del(`/api/garments/${item.id}`);
      App.ui.toast('已删除');
      load();
    } catch (err) {
      App.ui.toast(err.message, 'error');
    }
  }

  // ---------------------------------------------------------------- 数据

  async function load() {
    state.loading = true;
    try {
      const params = new URLSearchParams();
      if (state.category) params.set('category', state.category);
      if (state.color) params.set('color', state.color);
      if (state.season) params.set('season', state.season);
      if (state.scene) params.set('scene', state.scene);
      if (state.keyword) params.set('q', state.keyword);

      const query = params.toString();
      state.items = await App.api.get('/api/garments' + (query ? `?${query}` : ''));
      render();
    } catch (err) {
      App.ui.toast(err.message, 'error');
    } finally {
      state.loading = false;
    }
  }

  // ---------------------------------------------------------------- 初始化

  function init(meta) {
    state.meta = meta;
    cache();

    renderCategoryChips();
    fillSelect(els.color, meta.colors, '颜色');
    fillSelect(els.season, meta.seasons, '季节');
    fillSelect(
      els.scene,
      meta.scenes.map((name) => ({ value: name, label: name })),
      '场合'
    );

    els.color.addEventListener('change', () => {
      state.color = els.color.value;
      updateClearButton();
      load();
    });
    els.season.addEventListener('change', () => {
      state.season = els.season.value;
      updateClearButton();
      load();
    });
    els.scene.addEventListener('change', () => {
      state.scene = els.scene.value;
      updateClearButton();
      load();
    });
    els.clear.addEventListener('click', clearFilters);
    document.getElementById('btn-clear-empty').addEventListener('click', clearFilters);

    let timer = null;
    els.search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.keyword = els.search.value.trim();
        updateClearButton();
        load();
      }, 220);
    });

    updateClearButton();
    load();
  }

  App.wardrobe = { init, load };
})(window.App = window.App || {});
