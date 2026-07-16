document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const apiKeyInput = document.getElementById('api-key');
  const submitBtn = document.getElementById('submit-btn');
  const errorEl = document.getElementById('error-message');
  const loadingEl = document.getElementById('loading');
  const settingsLink = document.getElementById('settings-link');

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showError('Please enter your API key.');
      return;
    }
    setLoading(true);
    hideError();
    try {
      const result = await window.mintzy.auth.login(apiKey);
      if (result.success) {
        window.mintzy.navigation.showTerminal();
      } else {
        showError(result.message || 'Connection failed. Please try again.');
      }
    } catch (err) {
      showError('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  });

  function showError(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
  function hideError() { errorEl.classList.add('hidden'); }

  function setLoading(on) {
    loadingEl.classList.toggle('hidden', !on);
    submitBtn.disabled = on;
  }
});
