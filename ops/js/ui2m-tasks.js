/* Presentation only: keep the selected task filter visible after list renders. */
(() => {
  function init() {
    const container = document.getElementById('task-list-container');
    if (!container) return;
    const reveal = () => {
      if (!document.body.classList.contains('ui2m') || window.innerWidth > 900) return;
      const bar = container.querySelector('.tkc-bar');
      const selected = bar?.querySelector('.tkc.on');
      if (!selected) return;
      const bounds = bar.getBoundingClientRect();
      const item = selected.getBoundingClientRect();
      if (item.left < bounds.left) bar.scrollLeft += item.left - bounds.left;
      else if (item.right > bounds.right) bar.scrollLeft += item.right - bounds.right;
    };
    new MutationObserver(reveal).observe(container, { childList: true, subtree: true });
    window.addEventListener('resize', reveal);
    reveal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
