/* Small progressive enhancements shared by dynamically rendered views. */
(() => {
  const notice = document.createElement('p');
  notice.className = 'local-notice';
  notice.textContent = 'Local workspace: your data stays in this browser. The access code is a convenience lock, not secure authentication. Guest access opens the same data. Export regular backups and avoid sensitive information.';
  document.querySelector('.gate-card').after(notice);
  // Keep the disclosure inside the card without losing it when onboarding re-renders.
  const gateCard = document.getElementById('gateCard');
  function enhance() {
    if (!gateCard.contains(notice)) gateCard.append(notice);
    document.querySelectorAll('.field').forEach(field => {
      const label = field.querySelector('label');
      const control = field.querySelector('input[id],select[id],textarea[id]');
      if (label && control) label.htmlFor = control.id;
    });
    document.querySelectorAll('.nav-item').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
      button.title = button.querySelector('.nav-label').textContent;
    });
    document.querySelectorAll('button').forEach(button => {
      if (button.textContent.trim() === '✕' && !button.hasAttribute('aria-label')) button.setAttribute('aria-label', 'Close');
    });
  }
  // Observe only child changes: attribute enhancements must not trigger themselves.
  new MutationObserver(enhance).observe(document.querySelector('.app'), {childList:true, subtree:true});
  enhance();
  document.body.dataset.density = localStorage.getItem('trl-density') || 'comfortable';
  document.getElementById('setDensity').value = document.body.dataset.density;
  document.getElementById('gateCard').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target.id === 'gatePass') unlock();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('agentPanel').classList.contains('open')) {
      toggleAgent(false);
      document.getElementById('agentFab').focus();
    }
  });
})();
