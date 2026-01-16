// Background service worker for handling Jira API calls

console.log('Jira Copy Extension: Background service worker loaded');

/**
 * Create Basic Auth header from email and API token
 */
function createAuthHeader(email, apiToken) {
  const credentials = btoa(`${email}:${apiToken}`);
  return `Basic ${credentials}`;
}

/**
 * Fetch ticket details from source Jira
 */
async function fetchTicket(baseUrl, ticketKey, email, apiToken) {
  try {
    const url = `${baseUrl}/rest/api/3/issue/${ticketKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ticket: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      ticket: {
        key: data.key,
        summary: data.fields.summary,
        description: data.fields.description || '',
        url: `${baseUrl}/browse/${data.key}`,
        projectKey: data.fields.project.key,
        issueType: data.fields.issuetype.name
      }
    };
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create ticket on destination Jira
 */
async function createTicket(baseUrl, projectKey, summary, description, sourceTicketUrl, issueType, email, apiToken) {
  try {
    // Format description with link to original ticket
    const fullDescription = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Original ticket: '
            },
            {
              type: 'text',
              text: sourceTicketUrl,
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: sourceTicketUrl
                  }
                }
              ]
            }
          ]
        },
        {
          type: 'paragraph',
          content: []
        }
      ]
    };

    // Add original description if it exists
    if (description) {
      // If description is a string, convert to Atlassian Document Format
      if (typeof description === 'string') {
        fullDescription.content.push({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: description
            }
          ]
        });
      } else {
        // If it's already in ADF format, append it
        fullDescription.content = fullDescription.content.concat(description.content || []);
      }
    }

    const url = `${baseUrl}/rest/api/3/issue`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: {
            key: projectKey
          },
          summary: summary,
          description: fullDescription,
          issuetype: {
            name: issueType || 'Task'
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create ticket: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    return {
      success: true,
      ticket: {
        key: data.key,
        url: `${baseUrl}/browse/${data.key}`
      }
    };
  } catch (error) {
    console.error('Error creating ticket:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create issue link between source and destination tickets (on destination Jira)
 */
async function createIssueLink(baseUrl, sourceTicketKey, destTicketKey, email, apiToken) {
  try {
    const url = `${baseUrl}/rest/api/3/issueLink`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        type: {
          name: 'Relates'
        },
        inwardIssue: {
          key: sourceTicketKey
        },
        outwardIssue: {
          key: destTicketKey
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Failed to create issue link:', response.status, errorData);
      // Don't fail the whole operation if link creation fails
      return { success: false, error: 'Link creation failed but ticket was created' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating issue link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create remote link from source ticket to destination ticket (on source Jira)
 */
async function createRemoteLink(baseUrl, sourceTicketKey, destTicketUrl, destTicketKey, email, apiToken) {
  try {
    const url = `${baseUrl}/rest/api/3/issue/${sourceTicketKey}/remotelink`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        object: {
          url: destTicketUrl,
          title: `Copied to ${destTicketKey}`,
          icon: {
            url16x16: 'https://www.atlassian.com/favicon.ico',
            title: 'Jira'
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Failed to create remote link:', response.status, errorData);
      // Don't fail the whole operation if link creation fails
      return { success: false, error: 'Remote link creation failed but ticket was created' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating remote link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get configuration from storage
 */
async function getConfig() {
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
 * Save configuration to storage
 */
async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.session.set(config, () => {
      resolve({ success: true });
    });
  });
}

/**
 * Check if configuration is complete
 */
function isConfigured(config) {
  return !!(
    config.sourceJiraUrl &&
    config.sourceEmail &&
    config.sourceApiToken &&
    config.destJiraUrl &&
    config.destProjectKey &&
    config.destEmail &&
    config.destApiToken
  );
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    getConfig().then(config => {
      sendResponse({
        success: true,
        config: config,
        isConfigured: isConfigured(config)
      });
    });
    return true; // Keep message channel open
  }

  if (request.action === 'saveConfig') {
    saveConfig(request.config).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'fetchTicket') {
    getConfig().then(async config => {
      const result = await fetchTicket(
        request.baseUrl,
        request.ticketKey,
        config.sourceEmail,
        config.sourceApiToken
      );
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'copyTicket') {
    getConfig().then(async config => {
      // Create ticket on destination
      const createResult = await createTicket(
        config.destJiraUrl,
        config.destProjectKey,
        request.summary,
        request.description,
        request.sourceTicketUrl,
        request.issueType,
        config.destEmail,
        config.destApiToken
      );

      if (!createResult.success) {
        sendResponse(createResult);
        return;
      }

      // Try to create issue link on destination Jira (optional)
      await createIssueLink(
        config.destJiraUrl,
        request.sourceTicketKey,
        createResult.ticket.key,
        config.destEmail,
        config.destApiToken
      );

      // Try to create remote link on source Jira (optional)
      await createRemoteLink(
        config.sourceJiraUrl,
        request.sourceTicketKey,
        createResult.ticket.url,
        createResult.ticket.key,
        config.sourceEmail,
        config.sourceApiToken
      );

      sendResponse(createResult);
    });
    return true;
  }

  return false;
});
