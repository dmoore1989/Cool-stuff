# Jira Ticket Copy Extension

A Chrome extension that copies Jira tickets from one Jira instance to another with a single click.

## Features

- 🎯 One-click ticket copying from source to destination Jira
- 🔗 Automatic issue linking back to original ticket
- 🔒 Secure API token storage (session-only)
- 📝 Copies ticket title and description
- ✨ Clean, modern UI matching Jira's aesthetic

## Installation

### From Source (Development)

1. Clone or download this repository

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `jira-copy-extension` directory

5. The extension icon should appear in your Chrome toolbar

### Icon Files

The extension requires icon files (`icon16.png`, `icon48.png`, `icon128.png`). You can:
- Create your own icons (16x16, 48x48, and 128x128 pixels)
- Use a simple blue square with a "J" letter
- Generate icons using online tools like [favicon.io](https://favicon.io/)

Place the icon files in the root directory of the extension.

## Setup

### 1. Get Your Jira API Tokens

You'll need API tokens for both source and destination Jira instances:

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Jira Copy Extension")
4. Copy the generated token (you'll need it in the next step)

### 2. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Click "Configure Extension"
3. Fill in the configuration:

**Source Jira (where to copy FROM):**
- Jira URL: `https://company.atlassian.net`
- Email: Your email for the source Jira account
- API Token: The token you generated

**Destination Jira (where to copy TO):**
- Jira URL: `https://yourcompany.atlassian.net`
- Project Key: The project where tickets will be created (e.g., "PROJ")
- Email: Your email for the destination Jira account
- API Token: The token you generated

4. Click "Save Configuration"

## Usage

1. Navigate to a Jira ticket in your source instance (e.g., `https://company.atlassian.net/browse/ENG-1234`)

2. Click the Jira Copy Extension icon in your Chrome toolbar

3. Review the ticket information displayed in the popup

4. Click "Copy to Jira"

5. Wait for the success message

6. Click "Open New Ticket" to view the newly created ticket

The new ticket will include:
- The same title as the original
- The same description as the original
- A link back to the original ticket at the top

## Security

- API tokens are stored in `chrome.storage.session` (memory-only)
- Tokens are cleared when you close the browser
- No data is sent to any third-party servers
- All API calls go directly to your Jira instances

## Troubleshooting

### "Failed to fetch ticket. Please check your API tokens."

- Verify your source Jira URL is correct
- Check that your source email and API token are valid
- Make sure you have permission to view the ticket

### "Failed to copy ticket. Please check your destination configuration."

- Verify your destination Jira URL is correct
- Check that your destination email and API token are valid
- Verify the project key exists and you have permission to create issues
- Make sure the destination project uses "Task" as an issue type (or modify the code to use a different type)

### Extension icon doesn't appear

- Refresh the extensions page (`chrome://extensions/`)
- Make sure "Enabled" is toggled on for the extension
- Try reloading the extension

### Content script not working

- Refresh the Jira ticket page after installing/updating the extension
- Check browser console for errors (F12)
- Verify the URL pattern matches your Jira instance

## Development

### Project Structure

```
jira-copy-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── popup.html            # Main UI for the extension
├── popup.js              # UI logic and user interactions
├── background.js         # Service worker for API calls
├── content-script.js     # Detects Jira page and extracts ticket key
├── config.html           # Settings page for API tokens/URLs
├── config.js             # Configuration management
├── styles.css            # UI styling
└── README.md             # This file
```

### Key Technologies

- **Manifest V3** - Modern Chrome extension standard
- **Service Workers** - Background API handling
- **Content Scripts** - Page detection and data extraction
- **Chrome Storage API** - Secure credential storage
- **Jira REST API v3** - Ticket operations

### API Endpoints Used

- `GET /rest/api/3/issue/{issueKey}` - Fetch ticket details
- `POST /rest/api/3/issue` - Create new ticket
- `POST /rest/api/3/issueLink` - Create issue link

## Limitations

- Only copies title and description (not comments, attachments, or custom fields)
- Creates tickets as "Task" type (modify code for other types)
- Issue links may not work if cross-instance linking is disabled
- No batch copying support

## Future Enhancements

Potential features for future versions:
- Copy comments and attachments
- Copy custom fields (priority, labels, etc.)
- Support multiple destination projects
- Batch copy multiple tickets
- Two-way sync

## License

MIT License - feel free to modify and use as needed.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console logs (F12)
3. Verify API token permissions in Atlassian
4. Check network requests in developer tools

## Credits

Built with Chrome Extension Manifest V3 and Jira REST API v3.
