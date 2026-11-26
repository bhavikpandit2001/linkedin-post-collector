# LinkedIn Post Collector — Roadmap

## Overview
The **LinkedIn Post Collector** monorepo is structured into four progressive milestones taking the system from database foundation to a verified, end-to-end Chrome Extension + NestJS REST API workflow.

---

## Milestone 1: Foundation & Database
**Goal**: Establish the NestJS workspace, PostgreSQL TypeORM connection, relational schema, and JWT authentication layer.

### Deliverables
- NestJS configuration (`package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, `main.ts`, `app.module.ts`).
- `User` entity (`users` table) with numeric `@PrimaryGeneratedColumn()` ID, unique `email`, `passwordHash`, and `createdAt`.
- `SavedPost` entity (`saved_posts` table) with numeric `@PrimaryGeneratedColumn()` ID, `ManyToOne` relation to `User` (`onDelete: 'CASCADE'`), `@Unique(['userId', 'postUrl'])` composite constraint, `jsonb` columns for `mediaUrls`, `hashtags`, and `mentions`, and `extractedAt`.
- `AuthModule` with `bcryptjs` password hashing, `JwtStrategy`, `JwtAuthGuard`, `POST /api/auth/register`, and `POST /api/auth/login`.

### Key Architecture Decisions
- **Numeric Primary Keys**: Standard PostgreSQL auto-incrementing integer IDs for compact foreign keys and fast indexing.
- **Composite Unique Constraint**: `UNIQUE(user_id, post_url)` ensures multi-user isolation—different users can save the same LinkedIn post, while the same user cannot save duplicates.
- **Stateless JWT**: `passport-jwt` extracts Bearer tokens and attaches `{ userId, email }` to `req.user`.

---

## Milestone 2: Posts REST API & Validation
**Goal**: Implement the authenticated CRUD endpoints for saved posts with strict DTO validation, conflict handling, search/filtering, and extension-compatible CORS.

### Deliverables
- `CreatePostDto`, `UpdatePostDto`, and `QueryPostsDto` powered by `class-validator` and `class-transformer` (supporting snake_case payload fields mapped cleanly to entity properties).
- Global `ValidationPipe` (`whitelist: true`, `transform: true`) and `/api` global prefix in `main.ts`.
- `POST /api/posts`: Saves post for `req.user.userId`; catches PostgreSQL unique violation (`23505`) or existing record and throws `ConflictException({ message: 'Post already saved', post: existing })` (`409`).
- `GET /api/posts`: Queries posts for `req.user.userId` with optional `search` (`ILIKE` across `author_name`, `post_text`, `notes`, and `hashtags::text`) and optional `type` (`post_type`), sorted by `extractedAt DESC`.
- `PATCH /api/posts/:id` & `DELETE /api/posts/:id`: Enforces ownership (`userId === req.user.userId`, throwing `404 Not Found` otherwise).
- CORS configuration allowing `http://localhost:*` and `chrome-extension://*` origins with `Authorization` header support.

---

## Milestone 3: Chrome Extension DOM Engine
**Goal**: Build the Manifest V3 Chrome Extension skeleton, resilient LinkedIn feed observer, auto-expanding DOM extractor, and inline button state machine.

### Deliverables
- `manifest.json` (MV3) with `sidePanel` and `storage` permissions, `host_permissions` for `https://www.linkedin.com/*` and `http://localhost:4000/*`.
- Valid PNG icon assets (`icon16.png`, `icon48.png`, `icon128.png`).
- `observer.js`: Debounced `MutationObserver` watching LinkedIn feed containers (`div[data-urn^="urn:li:activity:"]`, `.feed-shared-update-v2`), guarded by `data-lpc-injected="true"`, injecting the compact **Extract Post** button into each post's social action bar.
- `extractor.js`: Expands `"see more"` / `"…more"` links (waiting `120ms` for DOM update) and extracts all 13 fields using resilient structural, ARIA, and URN selectors.
- Inline button state transitions: `Extract Post` $\rightarrow$ `Extracting...` $\rightarrow$ `Saved ✓` / `Already Saved` / `Login in Panel` / `Retry`.

---

## Milestone 4: Side Panel UI & Export
**Goal**: Implement the background service worker message router, responsive Chrome Side Panel application, slide-over edit drawer, and Excel-compatible CSV export.

### Deliverables
- `service-worker.js`: Configures `openPanelOnActionClick: true`, reads `apiBaseUrl` and `accessToken` from `chrome.storage.local`, executes `POST /api/posts`, and broadcasts `{ type: 'POST_ADDED', post }` on success.
- `sidepanel/index.html`, `sidepanel/app.js`, `sidepanel/sidepanel.css`:
  - Login / Register screen with configurable API Base URL.
  - Compact responsive table (`~380px–450px` width) with total count badge, debounced search input, `postType` filter dropdown, and real-time `POST_ADDED` row insertion.
  - Slide-over detail/edit drawer supporting `PATCH /api/posts/:id` (`notes`, `postText`, `authorName`) and `DELETE /api/posts/:id` with confirmation.
  - UTF-8 BOM (`\uFEFF`) CSV export with proper RFC-4180 escaping for Excel compatibility.

---

## Release Timeline
| Milestone | Focus | Target Sequence |
| :--- | :--- | :--- |
| **M1** | Foundation, PostgreSQL Entities & JWT Auth | Phase 1 – Phase 2 |
| **M2** | Posts CRUD, Search, 409 Conflict & CORS | Phase 3 |
| **M3** | MV3 Manifest, Feed Observer & 13-Field Extractor | Phase 4 |
| **M4** | Service Worker, Side Panel UI, Drawer & CSV Export | Phase 5 – Phase 6 |
