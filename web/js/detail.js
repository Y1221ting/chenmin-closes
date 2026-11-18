/* 衣服详情页：大图展示、信息、角度图替换、编辑与删除。 */
(function (App) {
  'use strict';

  const ANGLE_ORDER = ['front', 'side', 'back'];
  const state = { meta: null, garment: null };
  const els = {};

  function cache() {
    els.page = document.getElementById('page-garment');
    els.drawer = document.getElementById('drawer');
    els.name = document.getElementById('detail-name');
    els.placeholder = document.getElementById('detail-placeholder');
    els.info = document.getElementById('detail-info');
    els.angles = document.getElementById('angle-list');
    els.deleteBtn = document.getElementById('btn-delete-garment');
    els.editBtn = document.getElementById('btn-edit');
    els.backBtn = document.getElementById('btn-back');
  }

  function labelOf(key, value) {
    const found = (state.meta[key] || []).find((opt) => opt.value === value);
    return found ? found.label : value || '—';
  }

  // ---------------------------------------------------------------- 渲染

  function renderInfo(garment) {
    const rows = [
      ['类别', labelOf('categories', garment.category)],
      ['颜色', garment.color ? labelOf('colors', garment.color) : '—'],
      [
        '季节',
        garment.seasons.length
          ? garment.seasons.map((item) => labelOf('seasons', item)).join(' / ')
          : '—',
      ],
      ['场合', garment.occasions.length ? garment.occasions.join(' / ') : '—'],
      ['添加时间', garment.created_at || '—'],
    ];

    els.info.innerHTML = rows
      .map(
        ([label, value]) => `
        <div class="info-row">
          <span class="info-row__label">${label}</span>
          <span class="info-row__value">${App.ui.escapeHtml(value)}</span>
        </div>`
      )
      .join('');
  }

  function renderAngles(garment) {
    els.angles.innerHTML = '';

    ANGLE_ORDER.forEach((angle) => {
      const angleMeta = (state.meta.angles || []).find((opt) => opt.value === angle);
      const label = angleMeta ? angleMeta.label : angle;
      const image = garment.images[angle] || null;

      const row = document.createElement('div');
      row.className = 'angle-row';
      row.innerHTML = `
        <div class="angle-row__thumb">
          ${image ? `<img src="/data/${App.ui.escapeHtml(image.path)}" alt="${label}">` : ''}
        </div>
        <div class="angle-row__name">${label}</div>
        <span class="angle-row__state">${image ? '' : '未上传'}</span>
        <div class="angle-row__actions">
          <button class="btn btn--ghost" type="button">${image ? '替换' : '上传'}</button>
        </div>
      `;

      row.querySelector('button').addEventListener('click', () => pickImage(angle, label));
      els.angles.appendChild(row);
    });
  }

  function render() {
    const garment = state.garment;
    els.name.textContent = garment.name;

    const hasImages = Object.keys(garment.images).length > 0;
    els.placeholder.hidden = hasImages;
    App.rotateView.mount(garment.images);

    renderInfo(garment);
    renderAngles(garment);
  }

  // ---------------------------------------------------------------- 上传角度图

  function pickImage(angle, label) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/webp';

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      try {
        await App.api.upload(
          `/api/garments/${state.garment.id}/images?angle=${angle}`,
          file
        );
        App.ui.toast(`${label}图已更新`);
        await load(state.garment.id);
        App.wardrobe.load();
      } catch (err) {
        App.ui.toast(err.message, 'error');
      }
    });

    input.click();
  }

  // ---------------------------------------------------------------- 删除

  function resetDeleteButton() {
    els.deleteBtn.dataset.armed = '';
    els.deleteBtn.textContent = '删除';
  }

  async function onDelete() {
    if (els.deleteBtn.dataset.armed !== '1') {
      els.deleteBtn.dataset.armed = '1';
      els.deleteBtn.textContent = '确认删除？';
      setTimeout(() => {
        if (els.deleteBtn.dataset.armed === '1') {
          resetDeleteButton();
        }
      }, 3000);
      return;
    }

    try {
      await App.api.del(`/api/garments/${state.garment.id}`);
      App.ui.toast('已删除');
      resetDeleteButton();
      App.nav.toWardrobe();
      App.wardrobe.load();
    } catch (err) {
      App.ui.toast(err.message, 'error');
      resetDeleteButton();
    }
  }

  // ---------------------------------------------------------------- 加载

  async function load(garmentId) {
    try {
      state.garment = await App.api.get(`/api/garments/${garmentId}`);
      resetDeleteButton();
      render();
    } catch (err) {
      App.ui.toast(err.message, 'error');
      App.nav.toWardrobe();
    }
  }

  function init(meta) {
    state.meta = meta;
    cache();

    els.backBtn.addEventListener('click', () => App.nav.toWardrobe());
    els.editBtn.addEventListener('click', () => {
      if (state.garment) {
        App.garmentForm.openEdit(state.garment);
      }
    });
    els.deleteBtn.addEventListener('click', onDelete);

    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        !els.page.hidden &&
        els.drawer.hidden
      ) {
        App.nav.toWardrobe();
      }
    });
  }

  App.detail = { init, load };
})(window.App = window.App || {});
