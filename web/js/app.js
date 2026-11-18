/* 启动：加载字典数据，初始化各页面模块。 */
(function (App) {
  'use strict';

  async function boot() {
    try {
      const meta = await App.api.get('/api/meta');
      document.getElementById('app-version').textContent = `v${meta.app.version}`;
      App.nav.init();
      App.rotateView.init();
      App.garmentForm.init(meta);
      App.detail.init(meta);
      App.wardrobe.init(meta);
      App.outfits.init(meta);
      App.outfitEditor.init(meta);
      App.nav.handleRoute();
    } catch (err) {
      App.ui.toast(`启动失败：${err.message}`, 'error');
      document.getElementById('wardrobe-count').textContent = '本地服务连接失败';
    }
  }

  boot();
})(window.App = window.App || {});
