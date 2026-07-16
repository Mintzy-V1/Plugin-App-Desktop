document.addEventListener('DOMContentLoaded', () => {
  const retryBtn = document.getElementById('retry-btn');
  const detailEl = document.getElementById('error-detail');
  const supportLink = document.getElementById('support-link');

  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') || 'unknown';

  const messages = {
    network: 'Unable to connect to the Plugin terminal. Please check your internet connection and try again.',
    broker_expired: 'Your broker session has expired. Please log in to your broker again, then reconnect in Mintzy.',
    unknown: 'Something went wrong. Please try again.',
  };

  detailEl.textContent = messages[type] || messages.unknown;

  retryBtn.addEventListener('click', () => {
    retryBtn.disabled = true;
    retryBtn.textContent = 'Reconnecting...';
    window.mintzy.navigation.showTerminal();
  });

  supportLink.addEventListener('click', (e) => {
    e.preventDefault();
  });
});
