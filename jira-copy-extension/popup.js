// Popup UI logic

// State management
let currentState = {
  ticketInfo: null,
  ticketData: null,
  config: null
};

// UI state enum
const States = {
  NOT_CONFIGURED: 'not-configured',
  NOT_JIRA_PAGE: 'not-jira-page',
  LOADING: 'loading',
  TICKET_VIEW: 'ticket-view',
  COPYING: 'copying',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Show a specific state view and hide others
 */
function showState(stateName) {
  const allStates = document.querySelectorAll('.state-view');
  allStates.forEach(view => {
    view.style.display = 'none';
  });

  const stateView = document.getElementById(stateName);
  if (stateView) {
    stateView.style.display = 'block';
  }
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState(States.ERROR);
}

/**
 * Get current tab's ticket info from content script
 */
async function getCurrentTabTicketInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: 'getTicketInfo' }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not loaded yet, might not be a Jira page
        resolve({ isJiraPage: false });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Get configuration from background
 */
async function getConfig() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getConfig' }, (response) => {
      resolve(response);
    });
  });
}

/**
 * Fetch ticket details from Jira API
 */
async function fetchTicket(baseUrl, ticketKey) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'fetchTicket',
      baseUrl: baseUrl,
      ticketKey: ticketKey
    }, (response) => {
      resolve(response);
    });
  });
}

/**
 * Copy ticket to destination Jira
 */
async function copyTicket(sourceTicketKey, summary, description, sourceTicketUrl, issueType) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: 'copyTicket',
      sourceTicketKey: sourceTicketKey,
      summary: summary,
      description: description,
      sourceTicketUrl: sourceTicketUrl,
      issueType: issueType
    }, (response) => {
      resolve(response);
    });
  });
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Extract plain text from Atlassian Document Format
 */
function extractTextFromADF(adf) {
  if (!adf || typeof adf === 'string') return adf || '';

  let text = '';

  function traverse(node) {
    if (node.type === 'text') {
      text += node.text;
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  traverse(adf);
  return text;
}

/**
 * Display ticket information
 */
function displayTicket(ticket) {
  document.getElementById('ticket-key').textContent = ticket.key;
  document.getElementById('ticket-link').href = ticket.url;
  document.getElementById('ticket-summary').textContent = ticket.summary;

  const description = extractTextFromADF(ticket.description);
  const truncatedDesc = truncateText(description, 300);
  document.getElementById('ticket-description').textContent = truncatedDesc || 'No description';

  showState(States.TICKET_VIEW);
}

/**
 * Initialize the popup
 */
async function initialize() {
  showState(States.LOADING);

  // Check configuration
  const configResponse = await getConfig();
  currentState.config = configResponse.config;

  if (!configResponse.isConfigured) {
    showState(States.NOT_CONFIGURED);
    return;
  }

  // Get ticket info from current tab
  const ticketInfo = await getCurrentTabTicketInfo();
  currentState.ticketInfo = ticketInfo;

  if (!ticketInfo.isJiraPage || !ticketInfo.ticketKey) {
    showState(States.NOT_JIRA_PAGE);
    return;
  }

  // Fetch ticket details
  const ticketResponse = await fetchTicket(ticketInfo.baseUrl, ticketInfo.ticketKey);

  if (!ticketResponse.success) {
    showError(ticketResponse.error || 'Failed to fetch ticket. Please check your API tokens.');
    return;
  }

  currentState.ticketData = ticketResponse.ticket;
  displayTicket(ticketResponse.ticket);
}

/**
 * Handle copy button click
 */
async function handleCopyClick() {
  if (!currentState.ticketData) return;

  showState(States.COPYING);

  const result = await copyTicket(
    currentState.ticketData.key,
    currentState.ticketData.summary,
    currentState.ticketData.description,
    currentState.ticketData.url,
    currentState.ticketData.issueType
  );

  if (!result.success) {
    showError(result.error || 'Failed to copy ticket. Please check your destination configuration.');
    return;
  }

  // Show success
  document.getElementById('new-ticket-link').href = result.ticket.url;
  document.getElementById('new-ticket-link').textContent = `Open ${result.ticket.key}`;
  showState(States.SUCCESS);
}

/**
 * Open configuration page
 */
function openConfigPage() {
  chrome.runtime.openOptionsPage();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  initialize();

  // Configuration buttons
  document.getElementById('open-config-btn').addEventListener('click', openConfigPage);
  document.getElementById('footer-config-btn').addEventListener('click', openConfigPage);
  document.getElementById('error-config-btn').addEventListener('click', openConfigPage);

  // Copy button
  document.getElementById('copy-btn').addEventListener('click', handleCopyClick);

  // Retry button
  document.getElementById('retry-btn').addEventListener('click', initialize);

  // Copy another button
  document.getElementById('copy-another-btn').addEventListener('click', initialize);
});
