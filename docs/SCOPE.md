# LinkedIn Post Collector — Project Scope

## 1. Core Objective
**LinkedIn Post Collector** is a user-triggered, single-click productivity tool that extracts visible LinkedIn feed posts from the browser DOM into a **Chrome Side Panel** table backed by a **NestJS + PostgreSQL** cloud/local REST API.

It enables researchers, recruiters, content analysts, and founders to curate and annotate LinkedIn posts without leaving the feed, while maintaining strict compliance boundaries (zero automated scraping or background crawling).

---

## 2. In-Scope Features

### 2.1 Chrome Extension (Manifest V3)
- **Non-Intrusive Feed Integration**: Uses a debounced `MutationObserver` to detect LinkedIn feed cards (`div[data-urn^="urn:li:activity:"]` or `.feed-shared-update-v2`) and inject a compact **"Extract Post"** button into each post's social action bar, guarded by `data-lpc-injected="true"`.
- **Automatic Copy Expansion**: Before scraping text, automatically clicks any visible `"see more"` / `"…more"` truncation button inside the post and waits `120ms` for the full text to render.
- **13-Field DOM Extraction**:
  1. `author_name` — Display name of the post author
  2. `author_profile_url` — Canonical LinkedIn profile or company URL
  3. `post_text` — Full expanded post body text
  4. `post_url` — Canonical `https://www.linkedin.com/feed/update/urn:li:activity:...` URL
  5. `published_at_text` — Relative or formatted timestamp text (e.g., `2d`, `1w`, `3h`)
  6. `likes_count` — Parsed integer reaction count
  7. `comments_count` — Parsed integer comment count
  8. `reposts_count` — Parsed integer repost/share count
  9. `media_urls` — Array of image/video/document preview URLs attached to the post
  10. `hashtags` — Array of extracted `#hashtag` strings
  11. `mentions` — Array of extracted `@mention` names/URLs
  12. `post_type` — Classified post type (`text`, `image`, `video`, `article`, `document`, `poll`, `repost`)
  13. `extracted_at` — ISO-8601 UTC timestamp of extraction
- **Inline Button State Feedback**:
  - Default: `Extract Post`
  - In-flight: `Extracting...`
  - Success: `Saved ✓`
  - Duplicate (`409 Conflict`): `Already Saved`
  - Unauthenticated (`401`): `Login in Panel`
  - Network/server error: `Retry`
- **Chrome Side Panel UI**:
  - Opens on extension toolbar icon click (`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`).
  - **Authentication View**: Login / Register form + configurable API Base URL (defaults to `http://localhost:4000`), persisted in `chrome.storage.local`.
  - **Posts Table View**: Responsive compact layout (`~380px–450px` width) with total saved count badge, debounced live search, `postType` filter dropdown, real-time row insertion when `POST_ADDED` is broadcast from the service worker, direct external LinkedIn post links, delete button with confirmation, and **UTF-8 BOM (`\uFEFF`) Excel-compatible CSV export**.
  - **Slide-Over Detail / Edit Drawer**: View full post copy, metadata, media URLs, hashtags, mentions, engagement metrics, and edit `notes`, `postText`, or `authorName` via `PATCH /api/posts/:id`.

### 2.2 Backend API (NestJS + TypeScript + PostgreSQL + TypeORM)
- **Authentication**: Multi-user JWT authentication (`POST /api/auth/register`, `POST /api/auth/login`) with `bcryptjs` password hashing and `passport-jwt` bearer token validation.
- **Persistence**: PostgreSQL with TypeORM numeric `@PrimaryGeneratedColumn()` IDs on `users` and `saved_posts` tables.
- **Duplicate Prevention**: Enforced at both the UI layer (`Already Saved` state) and the database layer via `@Unique(['userId', 'postUrl'])` (`UNIQUE(user_id, post_url)`), returning HTTP `409 Conflict` with `{ message: 'Post already saved', post: existing }`.
- **Querying & Ownership**:
  - `GET /api/posts`: Scoped to `req.user.userId`, supports `search` (`ILIKE` across `author_name`, `post_text`, `notes`, and `hashtags::text`) and `type` (`post_type`), ordered by `extracted_at DESC`.
  - `PATCH /api/posts/:id`: Verifies ownership (`userId === req.user.userId`, throwing `404 Not Found` otherwise) and updates `notes`, `postText`, or `authorName`.
  - `DELETE /api/posts/:id`: Verifies ownership and deletes the record.
- **CORS**: Allows `http://localhost:*` and `chrome-extension://*` origins with `Authorization` header support.

---

## 3. Non-Functional Requirements
- **Performance**: Debounced `MutationObserver` (`150ms`) to prevent main-thread jank on infinite-scroll LinkedIn feeds; indexed/unique `(user_id, post_url)` lookup in PostgreSQL.
- **Reliability**: Resilient multi-fallback DOM selectors (data-urn, ARIA labels, structural classes) to tolerate minor LinkedIn markup variations.
- **Security**: Passwords hashed with `bcryptjs` (cost factor 10); stateless JWTs with configurable secret and expiration; strict `class-validator` whitelist & transform DTO validation; per-user row isolation on all `/api/posts` endpoints.
- **Portability**: Configurable `apiBaseUrl` in extension storage and `.env`-driven backend configuration.

---

## 4. Out-of-Scope & LinkedIn Compliance Boundaries
To respect platform integrity and user safety, the following are **explicitly out of scope**:
- **No Automated Scrolling or Bulk Scraping**: The extension never scrolls the feed programmatically, never queues background extraction jobs, and never extracts posts without an explicit user click on **Extract Post**.
- **No Hidden/Private API Calls**: No interception or replay of LinkedIn internal Voyager/GraphQL endpoints or cookies. Only visible, rendered DOM nodes on the active page are read.
- **No Rate-Limit Evasion or Multi-Account Rotation**: Single authenticated user session per browser profile.
- **No Automated Engagement**: Never likes, comments, reposts, or messages on behalf of the user.

---

## 5. End-to-End JSON Data Contract

### 5.1 `extractor.js` $\rightarrow$ `observer.js` $\rightarrow$ `service-worker.js`
Message sent via `chrome.runtime.sendMessage`:
```json
{
  "type": "SAVE_POST",
  "payload": {
    "author_name": "Jane Doe",
    "author_profile_url": "https://www.linkedin.com/in/janedoe",
    "post_text": "Full expanded post content...",
    "post_url": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678",
    "published_at_text": "2d",
    "likes_count": 142,
    "comments_count": 18,
    "reposts_count": 7,
    "media_urls": ["https://media.licdn.com/dms/image/..."],
    "hashtags": ["#engineering", "#typescript"],
    "mentions": ["John Smith"],
    "post_type": "image",
    "extracted_at": "2026-11-26T17:30:00.000Z"
  }
}
```

### 5.2 `service-worker.js` $\rightarrow$ NestJS `POST /api/posts`
Request (`Authorization: Bearer <access_token>`, `Content-Type: application/json`):
Uses the same 13-field payload (plus optional `notes`).

Response `201 Created`:
```json
{
  "id": 1,
  "userId": 1,
  "postUrl": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678",
  "authorName": "Jane Doe",
  "authorProfileUrl": "https://www.linkedin.com/in/janedoe",
  "postText": "Full expanded post content...",
  "postType": "image",
  "publishedAtText": "2d",
  "likesCount": 142,
  "commentsCount": 18,
  "repostsCount": 7,
  "mediaUrls": ["https://media.licdn.com/dms/image/..."],
  "hashtags": ["#engineering", "#typescript"],
  "mentions": ["John Smith"],
  "notes": "",
  "extractedAt": "2026-11-26T17:30:00.123Z"
}
```

Response `409 Conflict` (duplicate `(user_id, post_url)`):
```json
{
  "statusCode": 409,
  "message": "Post already saved",
  "post": {
    "id": 1,
    "userId": 1,
    "postUrl": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678",
    "authorName": "Jane Doe",
    "...": "..."
  }
}
```

### 5.3 `service-worker.js` $\rightarrow$ `sidepanel/app.js`
Broadcast via `chrome.runtime.sendMessage`:
```json
{
  "type": "POST_ADDED",
  "post": {
    "id": 1,
    "userId": 1,
    "postUrl": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678",
    "authorName": "Jane Doe",
    "authorProfileUrl": "https://www.linkedin.com/in/janedoe",
    "postText": "Full expanded post content...",
    "postType": "image",
    "publishedAtText": "2d",
    "likesCount": 142,
    "commentsCount": 18,
    "repostsCount": 7,
    "mediaUrls": ["https://media.licdn.com/dms/image/..."],
    "hashtags": ["#engineering", "#typescript"],
    "mentions": ["John Smith"],
    "notes": "",
    "extractedAt": "2026-11-26T17:30:00.123Z"
  }
}
```
And reply to `observer.js` `sendMessage` callback:
```json
{
  "ok": true,
  "status": "saved",
  "post": { "...": "..." }
}
```
Possible `status` values: `"saved"`, `"duplicate"`, `"unauthorized"`, `"error"`.
