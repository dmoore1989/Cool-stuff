// Content script to detect Jira ticket pages and extract ticket keys

/**
 * Extracts Jira ticket key from URL
 * Supports patterns like:
 * - /browse/ENG-1234
 * - /jira/software/c/projects/PROJ/issues/PROJ-456
 */
function extractTicketKey() {
  const url = window.location.href;

  // Pattern 1: /browse/TICKET-KEY
  const browseMatch = url.match(/\/browse\/([A-Z]+-\d+)/);
  if (browseMatch) {
    return browseMatch[1];
  }

  // Pattern 2: /issues/TICKET-KEY
  const issuesMatch = url.match(/\/issues\/([A-Z]+-\d+)/);
  if (issuesMatch) {
    return issuesMatch[1];
  }

  // Pattern 3: selectedIssue=TICKET-KEY in query params
  const urlParams = new URLSearchParams(window.location.search);
  const selectedIssue = urlParams.get('selectedIssue');
  if (selectedIssue && /^[A-Z]+-\d+$/.test(selectedIssue)) {
    return selectedIssue;
  }

  return null;
}

/**
 * Checks if current page is a Jira ticket page
 */
function isJiraTicketPage() {
  return extractTicketKey() !== null;
}

/**
 * Gets the base URL of the current Jira instance
 */
function getJiraBaseUrl() {
  const url = new URL(window.location.href);
  return `${url.protocol}//${url.host}`;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTicketInfo') {
    const ticketKey = extractTicketKey();
    const baseUrl = getJiraBaseUrl();

    sendResponse({
      isJiraPage: isJiraTicketPage(),
      ticketKey: ticketKey,
      baseUrl: baseUrl,
      ticketUrl: ticketKey ? `${baseUrl}/browse/${ticketKey}` : null
    });
  }

  return true; // Keep message channel open for async response
});

// Log for debugging
console.log('Jira Copy Extension: Content script loaded');
if (isJiraTicketPage()) {
  console.log('Jira Copy Extension: Detected ticket:', extractTicketKey());
}
