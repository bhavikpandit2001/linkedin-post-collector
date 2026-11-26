# LinkedIn Post Collector — Execution Phases

---

## Phase 1: Backend Bootstrap & Database Schema

### Goal & Context
Initialize the NestJS TypeScript project, configure environment loading and PostgreSQL TypeORM connectivity, and define the `User` and `SavedPost` database entities with numeric primary keys and composite uniqueness.

### Exact Files Touched
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/nest-cli.json`
- `backend/.env.example`
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/users/users.module.ts`
- `backend/src/users/user.entity.ts`
- `backend/src/posts/saved-post.entity.ts`

### Step-by-Step Implementation Checklist
- [x] Configure `backend/package.json` with NestJS v10+, TypeORM, `pg`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcryptjs`, `class-validator`, `class-transformer`, and `@nestjs/config`.
- [x] Create `tsconfig.json` and `nest-cli.json` for strict TypeScript compilation.
- [x] Create `.env.example` with `PORT`, `DATABASE_URL` / `DB_*`, `JWT_SECRET`, and `JWT_EXPIRES_IN`.
- [x] Implement `User` entity (`users` table) with `@PrimaryGeneratedColumn()`, unique `email`, `passwordHash` (`password_hash`), and `createdAt` (`created_at`).
- [x] Implement `SavedPost` entity (`saved_posts` table) with `@Unique(['userId', 'postUrl'])`, `ManyToOne(() => User, { onDelete: 'CASCADE' })`, and all 13 extracted fields + `notes`.
- [x] Configure `AppModule` with `ConfigModule.forRoot({ isGlobal: true })` and `TypeOrmModule.forRootAsync(...)`.
- [x] Configure `main.ts` with global prefix `/api`, global `ValidationPipe`, and CORS for `http://localhost:*` and `chrome-extension://*`.

### Acceptance & Verification Criteria
```bash
cd backend && npm install && npm run build
```
- TypeScript compiles with 0 errors.
- PostgreSQL tables `users` and `saved_posts` are created/synchronized with constraint `UQ_...` on `(user_id, post_url)`:
```sql
\d saved_posts
```

---

## Phase 2: JWT Authentication Module

### Goal & Context
Implement user registration, login, password hashing with `bcryptjs`, and JWT bearer token verification via `passport-jwt`.

### Exact Files Touched
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/auth/jwt-auth.guard.ts`
- `backend/src/auth/dto/auth.dto.ts`

### Step-by-Step Implementation Checklist
- [x] Create `AuthDto` with `@IsEmail()` and `@IsString() @MinLength(6)`.
- [x] Implement `AuthService.register()` checking for existing email (`409 Conflict`), hashing password with `bcryptjs`, saving user, and returning `{ access_token, user: { id, email } }`.
- [x] Implement `AuthService.login()` validating email and password (`401 Unauthorized` on mismatch) and returning `{ access_token, user: { id, email } }`.
- [x] Implement `JwtStrategy` extracting Bearer token and returning `{ userId: payload.sub, email: payload.email }`.
- [x] Export `JwtAuthGuard` extending `AuthGuard('jwt')`.

### Acceptance & Verification Criteria
```bash
# Register
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@example.com","password":"password123"}'

# Login
curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tester@example.com","password":"password123"}'
```
- Both endpoints return HTTP `201`/`200` with `{ "access_token": "...", "user": { "id": 1, "email": "tester@example.com" } }`.

---

## Phase 3: Posts REST API, Search & Duplicate Handling

### Goal & Context
Implement `PostsModule` with full CRUD, `409 Conflict` duplicate protection, `ILIKE` search, `post_type` filtering, and strict per-user ownership checks.

### Exact Files Touched
- `backend/src/posts/posts.module.ts`
- `backend/src/posts/posts.controller.ts`
- `backend/src/posts/posts.service.ts`
- `backend/src/posts/dto/create-post.dto.ts`
- `backend/src/posts/dto/update-post.dto.ts`
- `backend/src/posts/dto/query-posts.dto.ts`

### Step-by-Step Implementation Checklist
- [x] Create `CreatePostDto` validating all 13 extracted fields + optional `notes`.
- [x] Create `UpdatePostDto` validating optional `notes`, `postText` / `post_text`, and `authorName` / `author_name`.
- [x] Create `QueryPostsDto` validating optional `search` and `type`.
- [x] Implement `PostsService.create()` catching PostgreSQL error code `23505` (or pre-existing row) and throwing `ConflictException({ message: 'Post already saved', post: existing })`.
- [x] Implement `PostsService.findAll()` filtering by `userId`, optional `search` (`ILIKE` across `author_name`, `post_text`, `notes`, `hashtags::text`), and optional `type`, ordered by `extractedAt DESC`.
- [x] Implement `PostsService.update()` and `PostsService.remove()` verifying `userId` ownership and throwing `NotFoundException` if missing.
- [x] Protect all `PostsController` routes with `@UseGuards(JwtAuthGuard)`.

### Acceptance & Verification Criteria
```bash
TOKEN="<jwt_from_phase_2>"

# Create Post
curl -s -X POST http://localhost:4000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_url":"https://www.linkedin.com/feed/update/urn:li:activity:123","author_name":"Jane Doe","post_text":"Hello #typescript","hashtags":["#typescript"],"post_type":"text"}'

# Duplicate Check (expects 409 Conflict)
curl -i -s -X POST http://localhost:4000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"post_url":"https://www.linkedin.com/feed/update/urn:li:activity:123","author_name":"Jane Doe"}'

# Search & Filter
curl -s "http://localhost:4000/api/posts?search=typescript&type=text" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Phase 4: Chrome Extension Manifest V3 & DOM Extraction Engine

### Goal & Context
Create the MV3 extension manifest, PNG icons, content script styling, debounced `MutationObserver`, and resilient 13-field LinkedIn post extractor with auto-"see more" expansion.

### Exact Files Touched
- `extension/manifest.json`
- `extension/icons/icon16.png`
- `extension/icons/icon48.png`
- `extension/icons/icon128.png`
- `extension/src/content/styles.css`
- `extension/src/content/extractor.js`
- `extension/src/content/observer.js`

### Step-by-Step Implementation Checklist
- [x] Create `manifest.json` with `manifest_version: 3`, `sidePanel` + `storage` permissions, `host_permissions`, `background.service_worker`, `side_panel.default_path`, and `content_scripts`.
- [x] Generate valid `icon16.png`, `icon48.png`, and `icon128.png` assets.
- [x] Implement `extractor.js` with `expandSeeMore(postEl)` (clicks `"see more"` if present and waits `120ms`) and `extractPostData(postEl)` returning all 13 fields cleanly.
- [x] Implement `observer.js` with debounced `MutationObserver`, `data-lpc-injected="true"` guard, social action bar injection, and button state transitions (`Extracting...` $\rightarrow$ `Saved ✓` / `Already Saved` / `Login in Panel` / `Retry`).
- [x] Style injected button states cleanly in `styles.css` matching LinkedIn's action bar geometry.

### Acceptance & Verification Criteria
- Load `extension/` as an unpacked extension in `chrome://extensions`.
- Open `https://www.linkedin.com/feed/` and inspect DevTools Console: zero runtime errors.
- Confirm every visible feed post renders an **Extract Post** button in its social action bar and scrolling loads buttons on newly rendered posts.

---

## Phase 5: Background Service Worker & Side Panel UI

### Goal & Context
Implement `service-worker.js` to bridge content scripts, `chrome.storage.local`, and the NestJS API, and build the interactive Side Panel table, auth screen, slide-over detail/edit drawer, and CSV export.

### Exact Files Touched
- `extension/src/background/service-worker.js`
- `extension/src/sidepanel/index.html`
- `extension/src/sidepanel/app.js`
- `extension/src/sidepanel/sidepanel.css`

### Step-by-Step Implementation Checklist
- [x] Configure `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in `service-worker.js`.
- [x] Handle `SAVE_POST` messages in `service-worker.js`, reading `apiBaseUrl` and `accessToken`, calling `POST /api/posts`, returning `{ ok, status, post }` to the content script, and broadcasting `{ type: 'POST_ADDED', post }`.
- [x] Build `index.html` and `sidepanel.css` for `~380px–450px` Side Panel width with Auth view, Header + Count Badge, Search + Type Filter toolbar, Posts Table, and Slide-Over Detail/Edit Drawer.
- [x] Build `app.js` handling Login/Register, API URL configuration, `GET /api/posts` loading, real-time `POST_ADDED` table prepending, `PATCH /api/posts/:id` drawer saving, `DELETE /api/posts/:id` confirmation, and UTF-8 BOM (`\uFEFF`) CSV export.

### Acceptance & Verification Criteria
- Click the extension icon to open the Side Panel.
- Register or log in; verify `accessToken` is saved in `chrome.storage.local` via Side Panel DevTools.
- Click **Extract Post** on a LinkedIn feed card; verify button turns `Saved ✓` and the row appears immediately in the Side Panel table without refreshing.

---

## Phase 6: End-to-End Integration & Build Verification

### Goal & Context
Verify full compilation, database persistence, duplicate protection, search/filtering, drawer edits, deletion, and Excel CSV export across the entire monorepo.

### Exact Files Touched
- All files in `docs/`, `backend/`, and `extension/`.

### Step-by-Step Implementation Checklist
- [x] Run `npm install` and `npm run build` in `backend/` with zero TypeScript errors.
- [x] Verify PostgreSQL connection, `users` and `saved_posts` tables, and `UNIQUE(user_id, post_url)` constraint.
- [x] Verify end-to-end flow: Register $\rightarrow$ Extract Post $\rightarrow$ Real-time Side Panel update $\rightarrow$ Duplicate click (`Already Saved`) $\rightarrow$ Edit Notes in Drawer $\rightarrow$ Export CSV (UTF-8 BOM) $\rightarrow$ Delete Post.

### Acceptance & Verification Criteria
- `npm run build` in `backend/` exits with code `0`.
- CSV opens cleanly in Microsoft Excel with preserved UTF-8 characters (emojis, accents) and no garbled BOM header.
