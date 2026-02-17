# Photo Gallery – Backend Documentation

This document explains every backend module and the step-by-step flow of each operation.

---

## 1. Backend structure overview

```
backend/
├── server.js           # Entry point: Express app, MongoDB connection, middleware
├── config/
│   └── multer.js       # File upload configuration (storage, size, file type)
├── middleware/
│   └── auth.js         # Mock authentication (sets req.user)
├── models/
│   ├── User.js         # User schema (dummy for ownership)
│   └── Photo.js        # Photo schema (title, description, imageUrl, owner)
├── routes/
│   └── photos.js       # POST /api/photos, GET /api/photos, DELETE /api/photos/:id
└── uploads/            # Directory where uploaded image files are stored (created at runtime)
```

**Request flow (high level):**

1. Request hits Express → CORS & `express.json()` run.
2. If path is `/api/photos/*` → `photosRouter` runs.
3. For every `/api/photos` request → `mockAuth` runs first (sets `req.user`).
4. Then the specific route handler runs (POST with Multer, GET, or DELETE).
5. Response is sent (JSON or error).

---

## 2. Module-by-module explanation

### 2.1 `server.js` – Application entry point

**Purpose:** Start the Express app, connect to MongoDB, mount middleware and routes, and create the `uploads` folder.

**Step-by-step:**

| Step | Code / action | Explanation |
|------|----------------|-------------|
| 1 | `require('dotenv').config()` | Loads `.env` so `process.env.PORT`, `MONGODB_URI`, `FRONTEND_URL` are available. |
| 2 | `const UPLOADS_DIR = path.join(__dirname, 'uploads')` | Absolute path to `backend/uploads`. |
| 3 | `if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(...)` | Creates `backend/uploads` if it doesn’t exist so Multer can save files there. |
| 4 | `app.use(cors({ origin: ... }))` | Allows the frontend (e.g. `http://localhost:5173`) to call the API from the browser. |
| 5 | `app.use(express.json())` | Parses JSON request bodies (e.g. for other APIs); photo upload uses `multipart/form-data`, not JSON. |
| 6 | `app.use('/uploads', express.static(UPLOADS_DIR))` | Serves files from `backend/uploads` at URL `/uploads/<filename>`, so `<img src="/uploads/photo-123.jpg">` works. |
| 7 | `app.use('/api/photos', photosRouter)` | All `/api/photos` and `/api/photos/:id` requests are handled by `routes/photos.js`. |
| 8 | `mongoose.connect(...)` | Connects to MongoDB (default `mongodb://127.0.0.1:27017/photo-gallery`). |
| 9 | `app.listen(PORT)` | Starts HTTP server only after DB connection succeeds; default port 5001. |

**Environment variables (optional):**

- `PORT` – Server port (default `5001`).
- `MONGODB_URI` – MongoDB connection string (default `mongodb://127.0.0.1:27017/photo-gallery`).
- `FRONTEND_URL` – Allowed CORS origin (default `http://localhost:5173`).

---

### 2.2 `models/User.js` – User model

**Purpose:** Define the User collection for ownership. Used only by mock auth; in production you’d replace this with real auth.

**Schema:**

| Field     | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| username | String | yes      | Display name       |
| email    | String | yes      | Email              |
| (timestamps) | -  | -        | `createdAt`, `updatedAt` added by Mongoose |

**Usage:** The auth middleware finds or creates one user and sets `req.user.id` to that user’s `_id`. Every photo’s `owner` field stores this same ID.

---

### 2.3 `models/Photo.js` – Photo model

**Purpose:** Define the Photo collection: one document per uploaded image, with metadata and a reference to the owner.

**Schema:**

| Field       | Type                | Required | Description                                  |
|------------|---------------------|----------|----------------------------------------------|
| title      | String              | yes      | Photo title (e.g. from form)                 |
| description| String              | no       | Default `''`                                |
| imageUrl   | String              | yes      | URL path to file, e.g. `/uploads/photo-123.jpg` |
| owner      | ObjectId (ref User) | yes      | Who owns this photo (from `req.user.id`)    |
| createdAt  | Date                | auto     | Set by `timestamps: true`                   |
| updatedAt  | Date                | auto     | Set by `timestamps: true`                   |

**Why `imageUrl`:** The file is stored on disk under `backend/uploads/`. We save the path as `/uploads/<filename>` so the frontend can use it as the image `src`; Express serves it via `express.static(UPLOADS_DIR)`.

---

### 2.4 `config/multer.js` – File upload configuration

**Purpose:** Configure Multer to accept a single image per request, validate type/size, and save to disk with a unique name.

**Constants:**

- `MAX_FILE_SIZE = 5 * 1024 * 1024` → 5 MB max.
- `ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png']` → only these MIME types.

**Storage (`multer.diskStorage`):**

| Option        | Function | Behaviour |
|---------------|----------|-----------|
| `destination` | `(req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads'))` | Save all files into `backend/uploads`. |
| `filename`    | `(req, file, cb) => cb(null, 'photo-' + Date.now() + '-' + random + ext)` | Unique name: `photo-1739234567890-123456789.jpg` to avoid overwrites. |

**File filter:**

- If `file.mimetype` is in `ALLOWED_MIMES` → `cb(null, true)` (accept).
- Otherwise → `cb(new Error('Only .jpg, .jpeg, and .png images are allowed.'), false)` (reject).

**Exports:** A single Multer instance configured with:

- `storage` (disk, as above),
- `limits: { fileSize: MAX_FILE_SIZE }`,
- `fileFilter`.

**Usage in routes:** `upload.single('image')` means Multer expects one file in the form field named `image`. After the middleware runs, the file is in `req.file` (path, filename, size, etc.) and text fields are in `req.body`.

---

### 2.5 `middleware/auth.js` – Mock authentication

**Purpose:** For every request to `/api/photos`, ensure there is a “current user” and set `req.user.id` so routes can assign ownership and filter photos.

**Step-by-step:**

| Step | Action | Explanation |
|------|--------|-------------|
| 1 | `User.findOne()` | Try to find any existing user in the database. |
| 2 | If no user | `User.create({ username: 'demo-user', email: 'demo@example.com' })` to create one. |
| 3 | `req.user = { id: user._id.toString() }` | Attach the user’s ID to the request so routes can use `req.user.id`. |
| 4 | `next()` | Pass control to the next middleware/route. |
| 5 | On error | Respond with `500` and `{ error: 'Auth setup failed' }`. |

So in this app there is effectively one shared “demo” user; all photos belong to that user. In production you would replace this with JWT/session validation and set `req.user` from the token/session.

---

### 2.6 `routes/photos.js` – Photo API routes

**Purpose:** Implement POST (upload), GET (list), and DELETE (delete one photo and its file). All routes run after `mockAuth`, so `req.user.id` is always set.

**Middleware order for the router:**

1. `router.use(mockAuth)` → runs for every request to this router (all `/api/photos` paths).
2. Then the matching route handler runs (e.g. `upload.single('image')` for POST, then the handler function).

---

## 3. Operation 1: POST /api/photos (Upload a photo)

**Goal:** Accept one image file plus optional title/description, save the file to disk, and create a Photo document in MongoDB.

**Request:** `POST /api/photos` with body `multipart/form-data`:

- `image` – file (required)
- `title` – string (optional)
- `description` – string (optional)

**Step-by-step flow:**

| Step | Where | What happens |
|------|--------|--------------|
| 1 | Express | Request enters the app; CORS and `express.json()` run. |
| 2 | Router | Request matches `POST /api/photos`; router runs `mockAuth`. |
| 3 | auth.js | Finds or creates the demo user; sets `req.user = { id: user._id }`. |
| 4 | photos.js | Runs `upload.single('image')` (Multer). |
| 5 | Multer | Reads the multipart body; validates MIME type (jpeg/jpg/png) and file size (≤ 5MB). If invalid, Multer calls `next(err)` and the route handler is skipped. |
| 6 | Multer | If valid: saves file to `backend/uploads/` with a name like `photo-1739234567890-123456789.jpg`; sets `req.file` (path, filename, etc.) and fills `req.body` with title/description. |
| 7 | Route handler | Checks `if (!req.file)` → 400 “No image file provided.” |
| 8 | Route handler | Builds `imageUrl = '/uploads/' + req.file.filename` (e.g. `/uploads/photo-1739234567890-123456789.jpg`). |
| 9 | Route handler | `Photo.create({ title: req.body.title || 'Untitled', description: req.body.description || '', imageUrl, owner: req.user.id })` → new document in MongoDB. |
| 10 | Route handler | Responds with `201` and the created photo object (JSON). |
| 11 | On error | If `Photo.create` or anything else throws: deletes the uploaded file from disk (if `req.file` exists) with `fs.unlink(req.file.path)`, then sends 400 for “allowed”/file size errors, or 500 “Failed to save photo.” |

**Important:** The field name in the form must be `image` because of `upload.single('image')`. The frontend sends `FormData` with `formData.append('image', file)`.

---

## 4. Operation 2: GET /api/photos (List photos)

**Goal:** Return all photos owned by the current user, newest first.

**Request:** `GET /api/photos` (no body; auth is mock, so no token in this app).

**Step-by-step flow:**

| Step | Where | What happens |
|------|--------|--------------|
| 1 | Express | Request enters; CORS and `express.json()` run. |
| 2 | Router | Matches `GET /api/photos`; runs `mockAuth`. |
| 3 | auth.js | Sets `req.user.id` to the demo user’s `_id`. |
| 4 | Route handler | `Photo.find({ owner: req.user.id }).sort({ createdAt: -1 }).lean()` – finds all photos whose `owner` equals the current user, sorts by `createdAt` descending, and returns plain objects (no Mongoose docs). |
| 5 | Route handler | `res.json(photos)` – sends the array as JSON. |
| 6 | On error | Catches errors and responds with 500 and `{ error: 'Failed to fetch photos.' }`. |

**Why `owner: req.user.id`:** So each user only sees their own photos. With mock auth there is only one user, but the structure is ready for real multi-user auth.

---

## 5. Operation 3: DELETE /api/photos/:id (Delete a photo)

**Goal:** Delete the photo document from MongoDB and remove the image file from disk so no orphaned files remain.

**Request:** `DELETE /api/photos/:id` (e.g. `DELETE /api/photos/674a1b2c3d4e5f6789abcdef`). No body required.

**Step-by-step flow:**

| Step | Where | What happens |
|------|--------|--------------|
| 1 | Express | Request enters; CORS and `express.json()` run. |
| 2 | Router | Matches `DELETE /api/photos/:id`; runs `mockAuth`. |
| 3 | auth.js | Sets `req.user.id`. |
| 4 | Route handler | `Photo.findOne({ _id: req.params.id, owner: req.user.id })` – finds the photo only if it exists and belongs to the current user. |
| 5 | Route handler | If no photo → `res.status(404).json({ error: 'Photo not found.' })` and exit. |
| 6 | Route handler | Builds file path: `path.join(__dirname, '..', 'uploads', path.basename(photo.imageUrl))`. Example: `photo.imageUrl` is `/uploads/photo-123.jpg`, so `path.basename` is `photo-123.jpg`, and the full path is `backend/uploads/photo-123.jpg`. |
| 7 | Route handler | `await fs.unlink(filePath)` – deletes the file from disk. If the file is already missing, the error is ignored (no crash). |
| 8 | Route handler | `Photo.deleteOne({ _id: req.params.id })` – removes the document from MongoDB. |
| 9 | Route handler | `res.json({ message: 'Photo deleted.' })`. |
| 10 | On error | Any other error → 500 and `{ error: 'Failed to delete photo.' }`. |

**Why check `owner`:** So a user cannot delete another user’s photo by guessing IDs. With mock auth there is only one user, but the pattern is correct for multi-user.

---

## 6. Summary table

| Operation | Method | Path | Auth | Main steps |
|-----------|--------|------|------|------------|
| Upload   | POST   | /api/photos | mockAuth → sets req.user | Multer saves file → Photo.create with imageUrl & owner → 201 + photo |
| List     | GET    | /api/photos | mockAuth → sets req.user | Photo.find({ owner }).sort().lean() → 200 + array |
| Delete   | DELETE | /api/photos/:id | mockAuth → sets req.user | Find by _id + owner → fs.unlink(file) → Photo.deleteOne → 200 |

---

## 7. Data flow diagram (text)

```
[Client] POST /api/photos (multipart: image, title, description)
    → CORS, express.json()
    → photosRouter
    → mockAuth → req.user = { id: <demo user _id> }
    → upload.single('image') → file on disk, req.file + req.body
    → Photo.create({ title, description, imageUrl: '/uploads/...', owner: req.user.id })
    → 201 + photo JSON

[Client] GET /api/photos
    → mockAuth → req.user
    → Photo.find({ owner: req.user.id }).sort({ createdAt: -1 }).lean()
    → 200 + [ photos ]

[Client] DELETE /api/photos/:id
    → mockAuth → req.user
    → Photo.findOne({ _id, owner: req.user.id })
    → fs.unlink(backend/uploads/<filename>)
    → Photo.deleteOne({ _id })
    → 200 + { message: 'Photo deleted.' }
```

This is the complete backend behaviour: every module and every operation, step by step.
