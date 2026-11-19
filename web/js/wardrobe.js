/* 衣柜页：分类挂杆、悬停展开正面、筛选与搜索。 */
(function (App) {
  'use strict';

  const CLOTH_CATEGORIES = ['top', 'outer', 'bottom', 'dress'];
  const SHELF_CATEGORIES = ['shoes', 'bag', 'accessory'];

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
  let drag = null;

  function cache() {
    els.rack = document.getElementById('wardrobe-rack');
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
    return Boolean(
      state.category || state.color || state.season || state.scene || state.keyword
    );
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

    if (current) select.value = current;
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

  // ---------------------------------------------------------------- 挂件

  function imageVersion(item) {
    return item.updated_at ? `?v=${encodeURIComponent(item.updated_at)}` : '';
  }

  function escape(value) {
    return App.ui.escapeHtml(value);
  }

  function openGarment(item) {
    App.nav.toGarment(item.id);
  }

  // ---------------------------------------------------------------- 拖动排序

  function beginDrag(event, el) {
    drag = {
      el,
      rail: el.parentElement,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    try {
      el.setPointerCapture(event.pointerId);
    } catch (ignore) {
      /* 指针捕获失败时仍可拖动 */
    }
  }

  function onDragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.moved = true;
      drag.el.classList.add('is-dragging');
      document.body.classList.add('is-racking');
    }

    const items = Array.from(drag.rail.querySelectorAll('.rack-item'));
    if (!items.length) return;

    const firstRect = items[0].getBoundingClientRect();
    const lastRect = items[items.length - 1].getBoundingClientRect();

    if (event.clientX < firstRect.left) {
      drag.rail.insertBefore(drag.el, items[0]);
      return;
    }
    if (event.clientX > lastRect.right) {
      drag.rail.appendChild(drag.el);
      return;
    }

    const target = items.find((node) => {
      const rect = node.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right;
    });
    if (!target || target === drag.el) return;

    const rect = target.getBoundingClientRect();
    const before = event.clientX < rect.left + rect.width / 2;
    drag.rail.insertBefore(drag.el, before ? target : target.nextSibling);
  }

  async function onDragUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;

    const { el, rail, moved, pointerId } = drag;
    drag = null;
    try {
      el.releasePointerCapture(pointerId);
    } catch (ignore) {
      /* 已经释放时忽略 */
    }
    el.classList.remove('is-dragging');
    document.body.classList.remove('is-racking');

    if (!moved) return;
    el._dragEndedAt = Date.now();

    const ids = Array.from(rail.querySelectorAll('.rack-item')).map((node) =>
      Number(node.dataset.id)
    );
    try {
      await App.api.put('/api/garments/order', { ids });
      App.ui.toast('顺序已保存');
    } catch (err) {
      App.ui.toast(err.message, 'error');
      load();
    }
  }

  function rackItem(item, index) {
    const el = document.createElement('div');
    el.className = 'rack-item';
    el.dataset.id = item.id;
    el.style.animationDelay = `${Math.min(index, 10) * 30}ms`;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', item.name);

    const suffix = imageVersion(item);
    const images = item.images || {};
    const sidePath = images.side
      ? images.side.path
      : images.front
        ? images.front.path
        : null;
    const frontPath = item.thumb || (images.front ? images.front.path : null);
    const sideSrc = sidePath ? `/data/${escape(sidePath)}${suffix}` : '';
    const frontSrc = frontPath ? `/data/${escape(frontPath)}${suffix}` : '';

    const categoryLabels = labelsOf('categories');
    const colorLabels = labelsOf('colors');
    const metaText = [
      categoryLabels[item.category] || '',
      item.color ? colorLabels[item.color] || '' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    el.setAttribute('aria-label', metaText ? `${item.name} · ${metaText}` : item.name);

    el.innerHTML = `
      <span class="rack-item__hanger" aria-hidden="true">
        <svg viewBox="0 0 64 48">
          <path d="M32 20 V13 a6 6 0 1 1 7 -5"></path>
          <path d="M32 20 L7 42 H57 Z"></path>
        </svg>
      </span>
      <span class="rack-item__garment">
        ${sideSrc ? `<img class="rack-item__side" src="${sideSrc}" alt="" loading="lazy">` : ''}
        ${frontSrc ? `<img class="rack-item__front" src="${frontSrc}" alt="" loading="lazy">` : ''}
      </span>
      <span class="rack-item__name">${escape(item.name)}</span>
      <span class="rack-item__meta">${escape(metaText)}</span>
      <button class="rack-item__delete" type="button" title="删除">✕</button>
    `;

    el.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('.rack-item__delete')) return;
      beginDrag(event, el);
    });
    el.addEventListener('click', (event) => {
      if (event.target.closest('.rack-item__delete')) return;
      if (el._dragEndedAt && Date.now() - el._dragEndedAt < 300) return;
      openGarment(item);
    });
    el.addEventListener('keydown', (event) => {
      if (event.target !== el) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openGarment(item);
      }
    });
    el.querySelector('.rack-item__delete').addEventListener('click', (event) => {
      handleDelete(event, item);
    });

    return el;
  }

  function railSection(label, items, category) {
    const section = document.createElement('section');
    section.className = 'rack-section';
    section.dataset.category = category;
    section.innerHTML = `
      <div class="rack-section__head">
        <span class="rack-section__label">${escape(label)}</span>
        <span class="rack-section__count">${items.length}</span>
      </div>
      <div class="rack-section__body">
        <button class="rack-nav" type="button" data-dir="-1" aria-label="向左滚动">‹</button>
        <div class="rack-scroll">
          <div class="rack-track">
            <div class="rack-bar"></div>
            <div class="rack-items"></div>
          </div>
        </div>
        <button class="rack-nav" type="button" data-dir="1" aria-label="向右滚动">›</button>
      </div>
    `;

    const trackItems = section.querySelector('.rack-items');
    items.forEach((item, index) => trackItems.appendChild(rackItem(item, index)));

    const scroll = section.querySelector('.rack-scroll');
    section.querySelectorAll('.rack-nav').forEach((button) => {
      button.addEventListener('click', () => {
        const distance = Math.max(320, scroll.clientWidth * 0.8);
        scroll.scrollBy({
          left: Number(button.dataset.dir) * distance,
          behavior: 'smooth',
        });
      });
    });

    return section;
  }

  function shelfItem(item) {
    const el = document.createElement('div');
    el.className = 'shelf-item';
    el.dataset.id = item.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', item.name);

    const suffix = imageVersion(item);
    const src = item.thumb ? `/data/${escape(item.thumb)}${suffix}` : '';

    el.innerHTML = `
      ${src ? `<img src="${src}" alt="" loading="lazy">` : '<span class="shelf-item__empty">无图</span>'}
      <span class="shelf-item__name">${escape(item.name)}</span>
      <button class="shelf-item__delete" type="button" title="删除">✕</button>
    `;

    el.addEventListener('click', (event) => {
      if (event.target.closest('.shelf-item__delete')) return;
      openGarment(item);
    });
    el.addEventListener('keydown', (event) => {
      if (event.target !== el) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openGarment(item);
      }
    });
    el.querySelector('.shelf-item__delete').addEventListener('click', (event) => {
      handleDelete(event, item);
    });

    return el;
  }

  function shelfSection(items) {
    const section = document.createElement('section');
    section.className = 'shelf-section';
    section.innerHTML = `
      <div class="rack-section__head">
        <span class="rack-section__label">鞋包配饰</span>
        <span class="rack-section__count">${items.length}</span>
      </div>
      <div class="shelf">
        <div class="shelf__items"></div>
        <div class="shelf__line"></div>
      </div>
    `;

    const container = section.querySelector('.shelf__items');
    items.forEach((item) => container.appendChild(shelfItem(item)));
    return section;
  }

  // ---------------------------------------------------------------- 渲染

  function render() {
    const items = state.items;
    const filtered = hasFilters();

    els.rack.innerHTML = '';
    els.rack.hidden = items.length === 0;

    if (items.length) {
      els.count.textContent = filtered
        ? `筛选出 ${items.length} 件`
        : `${items.length} 件衣服`;
    } else {
      els.count.textContent = filtered ? '没有符合条件的衣服' : '还没有衣服';
    }

    els.empty.hidden = items.length > 0 || filtered || state.loading;
    els.filterEmpty.hidden = items.length > 0 || !filtered || state.loading;

    const grouped = {};
    items.forEach((item) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    (state.meta.categories || []).forEach((cat) => {
      if (!CLOTH_CATEGORIES.includes(cat.value)) return;
      const list = grouped[cat.value];
      if (!list || !list.length) return;
      els.rack.appendChild(railSection(cat.label, list, cat.value));
    });

    const shelfItems = SHELF_CATEGORIES.flatMap(
      (category) => grouped[category] || []
    );
    if (shelfItems.length) {
      els.rack.appendChild(shelfSection(shelfItems));
    }
  }

  async function handleDelete(event, item) {
    event.stopPropagation();

    const confirmed = await App.ui.confirm({
      title: `删除「${item.name}」？`,
      message: '这件衣服会移入回收站，图片不会立刻删除，可以随时恢复。',
      confirmText: '移入回收站',
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

    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragUp);
    window.addEventListener('pointercancel', onDragUp);

    updateClearButton();
    load();
  }

  App.wardrobe = { init, load };
})(window.App = window.App || {});
