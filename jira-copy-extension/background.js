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
 * Extract plain text from ADF structure
 */
function extractTextFromADF(adf) {
  if (!adf || typeof adf === 'string') {
    return adf || '';
  }

  let text = '';

  function traverse(node) {
    if (node.type === 'text') {
      text += node.text;
    } else if (node.type === 'hardBreak') {
      text += '\n';
    } else if (node.type === 'paragraph' && text.length > 0) {
      text += '\n\n';
    }

    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }

  traverse(adf);
  return text.trim();
}

/**
 * Create ticket on destination Jira
 */
async function createTicket(baseUrl, projectKey, summary, description, sourceTicketUrl, issueType, email, apiToken) {
  try {
    // Extract plain text from description (safer than trying to preserve ADF)
    const plainTextDescription = extractTextFromADF(description);

    // Build a simple, valid ADF structure
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
        }
      ]
    };

    // Add separator
    fullDescription.content.push({
      type: 'rule'
    });

    // Add the description content as plain text paragraphs
    if (plainTextDescription) {
      // Split by double newlines to preserve paragraph structure
      const paragraphs = plainTextDescription.split(/\n\n+/);

      paragraphs.forEach(para => {
        const trimmedPara = para.trim();
        if (trimmedPara) {
          // Split single newlines within a paragraph
          const lines = trimmedPara.split('\n');
          const paragraphContent = [];

          lines.forEach((line, index) => {
            if (line.trim()) {
              paragraphContent.push({
                type: 'text',
                text: line
              });

              // Add hard break between lines (except last line)
              if (index < lines.length - 1) {
                paragraphContent.push({
                  type: 'hardBreak'
                });
              }
            }
          });

          if (paragraphContent.length > 0) {
            fullDescription.content.push({
              type: 'paragraph',
              content: paragraphContent
            });
          }
        }
      });
    }

    const payload = {
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
    };

    // Log the payload for debugging
    console.log('Creating ticket with payload:', JSON.stringify(payload, null, 2));

    const url = `${baseUrl}/rest/api/3/issue`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to create ticket:', errorData);
      console.error('Payload that failed:', JSON.stringify(payload, null, 2));
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
 * Create issue link between tickets (works if Application Links are configured)
 */
async function createIssueLink(baseUrl, sourceTicketKey, destTicketKey, email, apiToken) {
  console.log('=== Attempting Issue Link (Linked Work Item) ===');
  console.log('JIRA URL:', baseUrl);
  console.log('Source ticket key:', sourceTicketKey);
  console.log('Destination ticket key:', destTicketKey);

  try {
    const payload = {
      type: {
        name: 'Relates'
      },
      inwardIssue: {
        key: sourceTicketKey
      },
      outwardIssue: {
        key: destTicketKey
      }
    };

    console.log('Issue link payload:', JSON.stringify(payload, null, 2));

    const url = `${baseUrl}/rest/api/3/issueLink`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Issue link response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('⚠️ Issue link failed:', errorData);
      console.warn('This likely means Application Links are not configured between JIRA instances');
      return { success: false, error: `Issue link failed: ${response.status}`, errorData };
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('✅ Issue link created successfully (Linked Work Item):', responseData);
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating issue link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Add a comment to a JIRA ticket
 */
async function addComment(baseUrl, ticketKey, commentText, email, apiToken) {
  console.log('=== Adding Comment to Ticket ===');
  console.log('JIRA URL:', baseUrl);
  console.log('Ticket key:', ticketKey);
  console.log('Comment:', commentText);

  try {
    const payload = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: commentText
              }
            ]
          }
        ]
      }
    };

    console.log('Comment payload:', JSON.stringify(payload, null, 2));

    const url = `${baseUrl}/rest/api/3/issue/${ticketKey}/comment`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Comment response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Failed to add comment:', errorData);
      return { success: false, error: `Comment creation failed: ${response.status} - ${JSON.stringify(errorData)}` };
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('✅ Comment added successfully:', responseData);
    return { success: true };
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create remote link (web link) between tickets
 * This is a fallback when Application Links are not configured
 */
async function createRemoteLink(baseUrl, sourceTicketKey, destTicketUrl, destTicketKey, email, apiToken) {
  console.log('=== Creating Remote Link ===');
  console.log('Source JIRA URL:', baseUrl);
  console.log('Source ticket key:', sourceTicketKey);
  console.log('Destination ticket URL:', destTicketUrl);
  console.log('Destination ticket key:', destTicketKey);

  try {
    const payload = {
      object: {
        url: destTicketUrl,
        title: `Copied to ${destTicketKey}`,
        icon: {
          url16x16: 'https://www.atlassian.com/favicon.ico',
          title: 'Jira'
        }
      }
    };

    console.log('Remote link payload:', JSON.stringify(payload, null, 2));

    const url = `${baseUrl}/rest/api/3/issue/${sourceTicketKey}/remotelink`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': createAuthHeader(email, apiToken),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Remote link response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Failed to create remote link:', errorData);
      console.error('Error details:', JSON.stringify(errorData, null, 2));
      // Don't fail the whole operation if link creation fails
      return { success: false, error: `Remote link creation failed: ${response.status} - ${JSON.stringify(errorData)}` };
    }

    const responseData = await response.json().catch(() => ({}));
    console.log('✅ Remote link created successfully:', responseData);
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating remote link:', error);
    console.error('Error stack:', error.stack);
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
      console.log('=== Starting Ticket Copy Operation ===');
      console.log('Source ticket:', request.sourceTicketKey);
      console.log('Source URL:', request.sourceTicketUrl);

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
        console.error('❌ Ticket creation failed, skipping link creation');
        sendResponse(createResult);
        return;
      }

      console.log('✅ Ticket created successfully:', createResult.ticket.key);
      console.log('New ticket URL:', createResult.ticket.url);

      // Add a comment to the source ticket
      console.log('\n--- Adding comment to source ticket ---');
      const commentResult = await addComment(
        config.sourceJiraUrl,
        request.sourceTicketKey,
        "We'll take a look at this",
        config.sourceEmail,
        config.sourceApiToken
      );

      if (commentResult.success) {
        console.log('✅ Comment added to source ticket');
      } else {
        console.warn('⚠️ Failed to add comment to source ticket:', commentResult.error);
        // Don't fail the whole operation if comment fails
      }

      // Strategy: Try to create proper issue links (Linked Work Items) first
      // If that fails (no Application Links configured), fall back to remote links (web links)

      // Try to create issue link on destination JIRA
      console.log('\n--- Attempting to create issue link on destination (Linked Work Item) ---');
      const destIssueLinkResult = await createIssueLink(
        config.destJiraUrl,
        request.sourceTicketKey,
        createResult.ticket.key,
        config.destEmail,
        config.destApiToken
      );

      if (destIssueLinkResult.success) {
        console.log('✅ Issue link created on destination - using Linked Work Items');

        // If issue link worked, try on source too
        console.log('\n--- Attempting to create issue link on source (Linked Work Item) ---');
        const sourceIssueLinkResult = await createIssueLink(
          config.sourceJiraUrl,
          createResult.ticket.key,
          request.sourceTicketKey,
          config.sourceEmail,
          config.sourceApiToken
        );

        if (sourceIssueLinkResult.success) {
          console.log('✅ Issue link created on source - using Linked Work Items');
          console.log('🎉 Success! Both tickets linked via Linked Work Items');
        } else {
          console.warn('⚠️ Source issue link failed, falling back to remote link');
          // Fall back to remote link on source
          const sourceRemoteLinkResult = await createRemoteLink(
            config.sourceJiraUrl,
            request.sourceTicketKey,
            createResult.ticket.url,
            createResult.ticket.key,
            config.sourceEmail,
            config.sourceApiToken
          );
          console.log(sourceRemoteLinkResult.success ? '✅ Remote link created on source' : '❌ Remote link also failed on source');
        }
      } else {
        // Issue links don't work, fall back to remote links
        console.log('⚠️ Issue links not available (Application Links likely not configured)');
        console.log('Falling back to remote links (web links)...');

        // Create remote link on source JIRA pointing to destination ticket
        console.log('\n--- Creating remote link on source ticket ---');
        const sourceRemoteLinkResult = await createRemoteLink(
          config.sourceJiraUrl,
          request.sourceTicketKey,
          createResult.ticket.url,
          createResult.ticket.key,
          config.sourceEmail,
          config.sourceApiToken
        );

        if (sourceRemoteLinkResult.success) {
          console.log('✅ Remote link created on source ticket');
        } else {
          console.warn('⚠️ Remote link creation on source failed:', sourceRemoteLinkResult.error);
        }

        // Create remote link on destination JIRA pointing back to source ticket
        console.log('\n--- Creating remote link on destination ticket ---');
        const destRemoteLinkResult = await createRemoteLink(
          config.destJiraUrl,
          createResult.ticket.key,
          request.sourceTicketUrl,
          request.sourceTicketKey,
          config.destEmail,
          config.destApiToken
        );

        if (destRemoteLinkResult.success) {
          console.log('✅ Remote link created on destination ticket');
        } else {
          console.warn('⚠️ Remote link creation on destination failed:', destRemoteLinkResult.error);
        }
      }

      console.log('\n=== Ticket Copy Operation Complete ===');
      sendResponse(createResult);
    });
    return true;
  }

  return false;
});
