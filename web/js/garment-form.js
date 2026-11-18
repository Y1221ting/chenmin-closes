/* 添加 / 编辑衣服抽屉：三张角度图 + 信息点选 + 上传。 */
(function (App) {
  'use strict';

  const state = {
    meta: null,
    mode: 'create',
    garmentId: null,
    files: { front: null, side: null, back: null },
    category: '',
    color: '',
    seasons: new Set(),
    occasions: new Set(),
    busy: false,
  };

  const els = {};
  const urls = [];

  function cache() {
    els.drawer = document.getElementById('drawer');
    els.form = document.getElementById('garment-form');
    els.title = document.getElementById('drawer-title');
    els.uploadHint = document.getElementById('upload-hint');
    els.name = document.getElementById('name-input');
    els.save = document.getElementById('btn-save');
    els.uploads = Array.from(document.querySelectorAll('.upload'));
  }

  function tileOf(angle) {
    return els.uploads.find((tile) => tile.dataset.angle === angle);
  }

  // ---------------------------------------------------------------- 图片预览

  function setPreviewUrl(tile, url) {
    const preview = tile.querySelector('[data-preview]');
    if (url) {
      preview.style.backgroundImage = `url("${url}")`;
      preview.classList.add('has-image');
    } else {
      preview.style.backgroundImage = '';
      preview.classList.remove('has-image');
    }
  }

  function setFilePreview(tile, file) {
    if (!file) {
      setPreviewUrl(tile, null);
      return;
    }
    const url = URL.createObjectURL(file);
    urls.push(url);
    setPreviewUrl(tile, url);
  }

  function releaseUrls() {
    while (urls.length) {
      URL.revokeObjectURL(urls.pop());
    }
  }

  function bindUploads() {
    els.uploads.forEach((tile) => {
      const input = tile.querySelector('input[type=file]');
      input.addEventListener('change', () => {
        const file = input.files && input.files[0] ? input.files[0] : null;
        state.files[tile.dataset.angle] = file;
        setFilePreview(tile, file);
      });
    });
  }

  // ---------------------------------------------------------------- 标签

  function toggleSet(set, value) {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
  }

  function isActive(key, value) {
    if (key === 'category') return state.category === value;
    if (key === 'color') return state.color === value;
    if (key === 'season') return state.seasons.has(value);
    return state.occasions.has(value);
  }

  function syncChips() {
    document.querySelectorAll('[data-chips]').forEach((container) => {
      const key = container.dataset.chips;
      container.querySelectorAll('.chip').forEach((btn) => {
        btn.classList.toggle('is-active', isActive(key, btn.dataset.value));
      });
    });
  }

  function onChipClick(key, value) {
    if (key === 'category') {
      state.category = state.category === value ? '' : value;
    } else if (key === 'color') {
      state.color = state.color === value ? '' : value;
    } else if (key === 'season') {
      toggleSet(state.seasons, value);
    } else {
      toggleSet(state.occasions, value);
    }
    syncChips();
  }

  function renderChips() {
    const groups = [
      ['category', state.meta.categories],
      ['color', state.meta.colors],
      ['season', state.meta.seasons],
      ['occasion', state.meta.scenes.map((name) => ({ value: name, label: name }))],
    ];

    groups.forEach(([key, options]) => {
      const container = document.querySelector(`[data-chips="${key}"]`);
      container.innerHTML = '';
      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip';
        btn.dataset.value = opt.value;
        btn.textContent = opt.label;
        btn.addEventListener('click', () => onChipClick(key, opt.value));
        container.appendChild(btn);
      });
    });
    syncChips();
  }

  // ---------------------------------------------------------------- 抽屉

  function resetFields() {
    state.mode = 'create';
    state.garmentId = null;
    state.files = { front: null, side: null, back: null };
    state.category = '';
    state.color = '';
    state.seasons = new Set();
    state.occasions = new Set();

    els.form.reset();
    els.uploads.forEach((tile) => {
      tile.querySelector('input[type=file]').value = '';
      setPreviewUrl(tile, null);
    });
    syncChips();
    releaseUrls();
  }

  function openCreate() {
    resetFields();
    els.title.textContent = '添加衣服';
    els.uploadHint.textContent = '正面必填，侧面和背面可稍后补';
    els.drawer.hidden = false;
    els.name.focus();
  }

  function openEdit(garment) {
    resetFields();
    state.mode = 'edit';
    state.garmentId = garment.id;
    state.category = garment.category || '';
    state.color = garment.color || '';
    state.seasons = new Set(garment.seasons || []);
    state.occasions = new Set(garment.occasions || []);

    els.title.textContent = '编辑衣服';
    els.uploadHint.textContent = '不重新选择就保留原图';
    els.name.value = garment.name;

    ['front', 'side', 'back'].forEach((angle) => {
      const image = garment.images && garment.images[angle];
      if (image) {
        setPreviewUrl(tileOf(angle), `/data/${image.path}`);
      }
    });

    syncChips();
    els.drawer.hidden = false;
    els.name.focus();
  }

  function close() {
    els.drawer.hidden = true;
    releaseUrls();
  }

  function setBusy(busy) {
    state.busy = busy;
    els.save.disabled = busy;
    els.save.textContent = busy ? '保存中…' : '保存';
  }

  // ---------------------------------------------------------------- 提交

  async function uploadSelected(garmentId) {
    for (const angle of ['front', 'side', 'back']) {
      const file = state.files[angle];
      if (!file) continue;
      await App.api.upload(`/api/garments/${garmentId}/images?angle=${angle}`, file);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (state.busy) return;

    const isEdit = state.mode === 'edit';
    const name = els.name.value.trim();

    if (!name) {
      App.ui.toast('请填写衣服名称', 'error');
      els.name.focus();
      return;
    }
    if (!state.category) {
      App.ui.toast('请选择衣服类别', 'error');
      return;
    }
    if (!isEdit && !state.files.front) {
      App.ui.toast('请先选择正面图', 'error');
      return;
    }

    setBusy(true);

    const payload = {
      name,
      category: state.category,
      color: state.color || null,
      seasons: Array.from(state.seasons),
      occasions: Array.from(state.occasions),
    };

    let garmentId = state.garmentId;

    try {
      if (isEdit) {
        await App.api.put(`/api/garments/${garmentId}`, payload);
      } else {
        const created = await App.api.post('/api/garments', payload);
        garmentId = created.id;
      }
      await uploadSelected(garmentId);
    } catch (err) {
      // 新建失败时把刚建的空衣服删掉，避免留下没有图片的记录
      if (!isEdit && garmentId) {
        try {
          await App.api.del(`/api/garments/${garmentId}`);
        } catch (ignore) {
          /* 删除失败不覆盖原始错误 */
        }
      }
      App.ui.toast(err.message || '保存失败，请重试', 'error');
      setBusy(false);
      return;
    }

    setBusy(false);
    close();
    App.ui.toast(isEdit ? '已保存' : '已添加到衣柜');
    App.wardrobe.load();
    if (isEdit && App.detail) {
      App.detail.load(garmentId);
    }
  }

  // ---------------------------------------------------------------- 初始化

  function init(meta) {
    state.meta = meta;
    cache();
    bindUploads();
    renderChips();

    els.form.addEventListener('submit', submit);
    els.drawer.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', close);
    });
    document.getElementById('btn-add').addEventListener('click', openCreate);
    document.getElementById('btn-add-empty').addEventListener('click', openCreate);
  }

  App.garmentForm = { init, openCreate, openEdit, close };
})(window.App = window.App || {});
