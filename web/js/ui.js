/* 通用界面工具：轻提示、HTML 转义。 */
(function (App) {
  'use strict';

  const stack = document.getElementById('toast-stack');

  function toast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ` toast--${type}` : '');
    el.textContent = message;
    stack.appendChild(el);

    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  App.ui = { toast, escapeHtml };
})(window.App = window.App || {});
