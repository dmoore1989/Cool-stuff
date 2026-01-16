// Configuration page logic

/**
 * Show alert message
 */
function showAlert(message, type = 'success') {
  const alert = document.getElementById('alert');
  alert.textContent = message;
  alert.className = `alert ${type} show`;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    alert.className = 'alert';
  }, 5000);
}

/**
 * Load saved configuration
 */
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.session.get([
      'sourceJiraUrl',
      'sourceEmail',
      'sourceApiToken',
      'destJiraUrl',
      'destProjectKey',
      'destEmail',
      'destApiToken'
    ], (result) => {
      resolve(result);
    });
  });
}

/**
 * Save configuration
 */
async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.session.set(config, () => {
      resolve({ success: true });
    });
  });
}

/**
 * Clear all configuration
 */
async function clearConfig() {
  return new Promise((resolve) => {
    chrome.storage.session.clear(() => {
      resolve({ success: true });
    });
  });
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && url.includes('atlassian.net');
  } catch {
    return false;
  }
}

/**
 * Populate form with saved values
 */
function populateForm(config) {
  document.getElementById('source-url').value = config.sourceJiraUrl || '';
  document.getElementById('source-email').value = config.sourceEmail || '';
  document.getElementById('source-token').value = config.sourceApiToken || '';
  document.getElementById('dest-url').value = config.destJiraUrl || '';
  document.getElementById('dest-project').value = config.destProjectKey || '';
  document.getElementById('dest-email').value = config.destEmail || '';
  document.getElementById('dest-token').value = config.destApiToken || '';
}

/**
 * Get form values
 */
function getFormValues() {
  return {
    sourceJiraUrl: document.getElementById('source-url').value.trim().replace(/\/$/, ''),
    sourceEmail: document.getElementById('source-email').value.trim(),
    sourceApiToken: document.getElementById('source-token').value.trim(),
    destJiraUrl: document.getElementById('dest-url').value.trim().replace(/\/$/, ''),
    destProjectKey: document.getElementById('dest-project').value.trim().toUpperCase(),
    destEmail: document.getElementById('dest-email').value.trim(),
    destApiToken: document.getElementById('dest-token').value.trim()
  };
}

/**
 * Validate form values
 */
function validateForm(config) {
  const errors = [];

  if (!isValidUrl(config.sourceJiraUrl)) {
    errors.push('Source Jira URL must be a valid HTTPS Atlassian URL');
  }

  if (!config.sourceEmail || !config.sourceEmail.includes('@')) {
    errors.push('Source email is invalid');
  }

  if (!config.sourceApiToken) {
    errors.push('Source API token is required');
  }

  if (!isValidUrl(config.destJiraUrl)) {
    errors.push('Destination Jira URL must be a valid HTTPS Atlassian URL');
  }

  if (!config.destProjectKey || !/^[A-Z]+$/.test(config.destProjectKey)) {
    errors.push('Destination project key must be uppercase letters only');
  }

  if (!config.destEmail || !config.destEmail.includes('@')) {
    errors.push('Destination email is invalid');
  }

  if (!config.destApiToken) {
    errors.push('Destination API token is required');
  }

  return errors;
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
  event.preventDefault();

  const config = getFormValues();
  const errors = validateForm(config);

  if (errors.length > 0) {
    showAlert(errors.join('. '), 'error');
    return;
  }

  try {
    await saveConfig(config);
    showAlert('Configuration saved successfully!', 'success');
  } catch (error) {
    showAlert('Failed to save configuration: ' + error.message, 'error');
  }
}

/**
 * Handle clear button
 */
async function handleClear() {
  if (!confirm('Are you sure you want to clear all configuration?')) {
    return;
  }

  try {
    await clearConfig();
    document.getElementById('config-form').reset();
    showAlert('Configuration cleared', 'success');
  } catch (error) {
    showAlert('Failed to clear configuration: ' + error.message, 'error');
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  // Load and populate form
  const config = await loadConfig();
  populateForm(config);

  // Set up event listeners
  document.getElementById('config-form').addEventListener('submit', handleSubmit);
  document.getElementById('clear-btn').addEventListener('click', handleClear);
});
