# LinkedIn Post Collector

A lightweight Chrome Extension (Manifest V3) that adds an **Extract Post** button beneath LinkedIn feed posts and syncs them into an interactive **Chrome Side Panel** table with instant **Excel CSV export**.

## Features
- **One-Click Extraction**: Injects an **Extract Post** button into LinkedIn feed cards and auto-expands `"see more"` text before scraping.
- **13 Extracted Fields**: Author name, profile URL, post text, post URL, published time, likes, comments, reposts, media URLs, hashtags, mentions, post type, and extraction timestamp.
- **Side Panel Table**: Live search, post-type filtering, duplicate prevention, and a slide-over detail/edit drawer for personal notes.
- **100% Local & Private**: Stored in `chrome.storage.local` with no external server or login required.
- **Excel-Ready Export**: One-click UTF-8 BOM CSV download.

## Installation
1. Clone or download this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.
4. Open `https://www.linkedin.com/feed/`, click **Extract Post** beneath any post, and open the Side Panel from the toolbar icon to view and export your table.
