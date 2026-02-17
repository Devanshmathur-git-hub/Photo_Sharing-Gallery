# Photo Gallery Backend - Deep Dive Explanation

This document provides an **extremely detailed** explanation of every module, every line of code, and every operation in the backend.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Module 1: server.js - Application Entry Point](#module-1-serverjs)
3. [Module 2: config/db.js - Database Connection](#module-2-configdbjs)
4. [Module 3: config/multer.js - File Upload Configuration](#module-3-configmulterjs)
5. [Module 4: models/User.js - User Schema](#module-4-modelsuserjs)
6. [Module 5: models/Photo.js - Photo Schema](#module-5-modelsphotojs)
7. [Module 6: middleware/auth.js - Authentication Middleware](#module-6-middlewareauthjs)
8. [Module 7: routes/photos.js - API Routes](#module-7-routesphotosjs)
9. [Operation 1: POST /api/photos - Upload Photo (Complete Flow)](#operation-1-post-apiphotos)
10. [Operation 2: GET /api/photos - List Photos (Complete Flow)](#operation-2-get-apiphotos)
11. [Operation 3: DELETE /api/photos/:id - Delete Photo (Complete Flow)](#operation-3-delete-apiphotosid)
12. [Error Handling Deep Dive](#error-handling-deep-dive)
13. [Memory Management & File Handling](#memory-management--file-handling)
14. [Security Considerations](#security-considerations)

---

## Architecture Overview

### Request Lifecycle (Complete Flow)

```
1. HTTP Request arrives at Express server
   ↓
2. CORS middleware checks origin
   ↓
3. express.json() parses JSON body (if Content-Type: application/json)
   ↓
4. express.static() serves static files (if path matches /uploads/*)
   ↓
5. Router matches path (/api/photos/*)
   ↓
6. mockAuth middleware runs → sets req.user
   ↓
7. Route-specific middleware (e.g., upload.single('image'))
   ↓
8. Route handler executes business logic
   ↓
9. Response sent back to client
```

### Technology Stack Deep Dive

- **Express.js**: Web framework that handles HTTP requests/responses, routing, middleware
- **Mongoose**: ODM (Object Document Mapper) for MongoDB - converts JS objects ↔ MongoDB documents
- **Multer**: Middleware for handling `multipart/form-data` (file uploads)
- **MongoDB**: NoSQL database storing documents in BSON format
- **Node.js fs module**: File system operations (create directories, delete files)

---

## Module 1: server.js

**Purpose**: Application entry point - initializes Express app, sets up middleware, connects to database, starts HTTP server.

### Line-by-Line Breakdown

```javascript
require('dotenv').config();
```
**What happens**: 
- Loads environment variables from `.env` file (if exists) into `process.env`
- If `.env` doesn't exist, uses system environment variables
- **Why**: Keeps sensitive data (DB URI, ports) out of code

```javascript
const path = require('path');
const fs = require('fs');
```
**What happens**:
- `path`: Provides utilities for working with file/directory paths (cross-platform)
- `fs`: File system module for synchronous operations (we use `fs.existsSync`, `fs.mkdirSync`)

```javascript
const express = require('express');
const cors = require('cors');
```
**What happens**:
- `express`: Creates the web application framework
- `cors`: Middleware to handle Cross-Origin Resource Sharing (allows frontend to call API)

```javascript
const photosRouter = require('./routes/photos');
const connectDB = require('./config/db');
```
**What happens**:
- Imports the photos router (handles `/api/photos` routes)
- Imports database connection function

```javascript
const app = express();
```
**What happens**:
- Creates Express application instance
- This `app` object handles all HTTP requests, middleware, routing

```javascript
const PORT = process.env.PORT || 5001;
```
**What happens**:
- Reads `PORT` from environment (e.g., `.env` file) or defaults to `5001`
- **Why 5001**: macOS AirPlay uses port 5000, so we avoid conflicts

```javascript
const UPLOADS_DIR = path.join(__dirname, 'uploads');
```
**What happens**:
- `__dirname`: Absolute path to directory containing `server.js` (e.g., `/Users/.../backend`)
- `path.join(__dirname, 'uploads')`: Creates path `backend/uploads`
- **Why `path.join`**: Handles path separators correctly on Windows (`\`) vs Unix (`/`)

```javascript
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
```
**What happens**:
- `fs.existsSync(UPLOADS_DIR)`: Synchronously checks if directory exists
- `fs.mkdirSync(..., { recursive: true })`: Creates directory if missing, including parent directories
- **Why**: Multer needs this directory to exist before saving files

```javascript
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
```
**What happens**:
- `app.use()`: Registers middleware that runs for **every request**
- `cors({ origin: ... })`: Allows requests from specified origin (frontend URL)
- **How CORS works**: Browser sends `Origin` header → server checks if allowed → sends `Access-Control-Allow-Origin` header
- **Why needed**: Browser's same-origin policy blocks cross-origin requests without CORS headers

```javascript
app.use(express.json());
```
**What happens**:
- Parses request body if `Content-Type: application/json`
- Converts JSON string → JavaScript object → attaches to `req.body`
- **Note**: Photo uploads use `multipart/form-data`, not JSON, so this doesn't affect uploads

```javascript
app.use('/uploads', express.static(UPLOADS_DIR));
```
**What happens**:
- `express.static()`: Serves static files from `UPLOADS_DIR` directory
- When request is `GET /uploads/photo-123.jpg` → Express looks for `backend/uploads/photo-123.jpg` → sends file
- **Why**: Frontend needs to display images via `<img src="/uploads/photo-123.jpg">`

```javascript
app.use('/api/photos', photosRouter);
```
**What happens**:
- Mounts `photosRouter` at `/api/photos` path
- All routes in `photosRouter` become `/api/photos/*`
- Example: Router's `router.post('/')` becomes `POST /api/photos`

```javascript
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
```
**What happens**:
- `connectDB()`: Async function that connects to MongoDB (returns Promise)
- `.then()`: Waits for DB connection to succeed
- `app.listen(PORT, callback)`: Starts HTTP server listening on port `PORT`
- **Why wait for DB**: Don't start server if database connection fails (prevents errors later)

---

## Module 2: config/db.js

**Purpose**: Handles MongoDB connection, connection events, graceful shutdown.

### Deep Dive

```javascript
const mongoose = require('mongoose');
```
**What happens**:
- Imports Mongoose library
- Mongoose provides schema validation, query building, connection pooling

```javascript
const connectDB = async () => {
```
**What happens**:
- Defines async function (can use `await` inside)
- Returns Promise that resolves when connection succeeds

```javascript
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/photo-gallery';
```
**What happens**:
- Reads MongoDB connection string from environment or uses default
- Format: `mongodb://[host]:[port]/[database-name]`
- `127.0.0.1:27017`: Local MongoDB default host/port
- `photo-gallery`: Database name (MongoDB creates if doesn't exist)

```javascript
await mongoose.connect(mongoURI);
```
**What happens**:
- **Connection process**:
  1. Mongoose opens TCP socket to MongoDB server
  2. Authenticates (if credentials provided)
  3. Selects database (`photo-gallery`)
  4. Sets up connection pool (reuses connections for performance)
- **Why `await`**: Waits for connection to complete before continuing
- **If fails**: Throws error → caught by `catch` block

```javascript
console.log('MongoDB connected successfully');
```
**What happens**:
- Logs success message to console
- **When**: Only after connection is fully established

```javascript
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
```
**What happens**:
- Registers event listener for connection errors
- **When triggered**: If connection drops or error occurs after initial connection
- **Why**: Helps debug connection issues in production

```javascript
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
```
**What happens**:
- Listens for disconnection events
- **When triggered**: MongoDB server closes connection (server restart, network issue)

```javascript
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});
```
**What happens**:
- `SIGINT`: Signal sent when user presses Ctrl+C
- **Graceful shutdown**: Closes DB connection before exiting
- **Why important**: Prevents connection leaks, ensures data integrity

```javascript
catch (error) {
  console.error('MongoDB connection error:', error.message);
  process.exit(1);
}
```
**What happens**:
- Catches connection errors
- Logs error message
- `process.exit(1)`: Exits with error code (1 = failure)
- **Why exit**: Can't run app without database connection

---

## Module 3: config/multer.js

**Purpose**: Configures Multer to handle file uploads - validates file type/size, saves to disk with unique names.

### Deep Dive

```javascript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
```
**What happens**:
- `5 * 1024`: 5 kilobytes
- `* 1024`: Converts to megabytes (5MB = 5,242,880 bytes)
- **Why limit**: Prevents huge files from consuming disk space/server memory

```javascript
const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png'];
```
**What happens**:
- MIME types (Multipurpose Internet Mail Extensions) identify file types
- `image/jpeg` and `image/jpg`: Same type, different extensions
- `image/png`: PNG images
- **Why validate**: Prevents malicious files (e.g., `.exe`, `.php`) from being uploaded

```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
```
**What happens**:
- `multer.diskStorage()`: Configures Multer to save files to disk (not memory)
- `destination`: Function called for each file to determine save location
- `__dirname`: Path to `backend/config` directory
- `path.join(__dirname, '..', 'uploads')`: Goes up one level (`backend`) → `uploads` folder
- `cb(null, path)`: Callback - first arg is error (null = success), second is destination path
- **Why diskStorage**: For large files, memory storage would consume too much RAM

```javascript
filename: (req, file, cb) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname) || '.jpg';
  cb(null, `photo-${uniqueSuffix}${ext}`);
},
```
**What happens**:
- `Date.now()`: Current timestamp in milliseconds (e.g., `1739234567890`)
- `Math.round(Math.random() * 1e9)`: Random number 0-1 billion (adds extra uniqueness)
- `path.extname(file.originalname)`: Extracts extension (`.jpg`, `.png`) from original filename
- `|| '.jpg'`: Default to `.jpg` if no extension found
- **Result**: `photo-1739234567890-123456789.jpg`
- **Why unique names**: Prevents filename collisions if two users upload `image.jpg` simultaneously

```javascript
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);  // Accept file
  } else {
    cb(new Error('Only .jpg, .jpeg, and .png images are allowed.'), false);  // Reject
  }
};
```
**What happens**:
- `fileFilter`: Function called for each file before saving
- `file.mimetype`: MIME type detected by Multer (e.g., `image/jpeg`)
- `cb(null, true)`: Accept file (no error, proceed)
- `cb(error, false)`: Reject file (error message, don't save)
- **When called**: Before file is written to disk
- **Why**: Double-checks file type (client-side validation can be bypassed)

```javascript
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
```
**What happens**:
- Creates Multer instance with configuration
- `storage`: Where/how to save files (diskStorage)
- `limits.fileSize`: Maximum file size (5MB)
- `fileFilter`: Validation function
- **Result**: `upload` object with methods like `upload.single()`, `upload.array()`

```javascript
module.exports = upload;
```
**What happens**:
- Exports the configured Multer instance
- Other files can `require('./config/multer')` to use it

### How Multer Works Internally

1. **Request arrives** with `Content-Type: multipart/form-data`
2. **Multer middleware** (`upload.single('image')`) intercepts request
3. **Parses multipart body**: Separates file data from form fields
4. **Runs fileFilter**: Validates MIME type
5. **Checks fileSize**: Validates against limit
6. **Calls storage.destination()**: Gets save directory
7. **Calls storage.filename()**: Gets unique filename
8. **Writes file to disk**: Streams file data to destination
9. **Attaches to request**: Sets `req.file` (file info) and `req.body` (form fields)
10. **Calls next()**: Passes to next middleware/route handler

---

## Module 4: models/User.js

**Purpose**: Defines User schema - structure of user documents in MongoDB.

### Deep Dive

```javascript
const mongoose = require('mongoose');
```
**What happens**: Imports Mongoose for schema definition

```javascript
const userSchema = new mongoose.Schema({
```
**What happens**:
- `mongoose.Schema()`: Creates schema definition (blueprint for documents)
- Schema defines: field names, types, validation rules, defaults

```javascript
username: { type: String, required: true },
```
**What happens**:
- `type: String`: Field must be a string
- `required: true`: Field is mandatory (Mongoose throws error if missing)
- **MongoDB storage**: Stored as BSON string type

```javascript
email: { type: String, required: true },
```
**What happens**: Same as username - required string field

```javascript
}, { timestamps: true });
```
**What happens**:
- `timestamps: true`: Mongoose automatically adds:
  - `createdAt`: Date when document created
  - `updatedAt`: Date when document last modified
- **Why**: Tracks when users were created/updated

```javascript
module.exports = mongoose.model('User', userSchema);
```
**What happens**:
- `mongoose.model('User', userSchema)`: Creates model (class for interacting with `users` collection)
- First arg `'User'`: Model name (Mongoose pluralizes → `users` collection)
- **Result**: `User` model with methods like `User.create()`, `User.findOne()`, `User.findById()`

### MongoDB Document Example

```json
{
  "_id": ObjectId("674a1b2c3d4e5f6789abcdef"),
  "username": "demo-user",
  "email": "demo@example.com",
  "createdAt": ISODate("2024-01-15T10:30:00Z"),
  "updatedAt": ISODate("2024-01-15T10:30:00Z")
}
```

---

## Module 5: models/Photo.js

**Purpose**: Defines Photo schema - structure of photo documents.

### Deep Dive

```javascript
const photoSchema = new mongoose.Schema({
  title: { type: String, required: true },
```
**What happens**:
- Required string field for photo title
- **Example**: "Sunset at the beach"

```javascript
description: { type: String, default: '' },
```
**What happens**:
- Optional string field
- `default: ''`: If not provided, defaults to empty string
- **Why optional**: Users might not always provide description

```javascript
imageUrl: { type: String, required: true },
```
**What happens**:
- Required string storing path to image file
- **Example**: `/uploads/photo-1739234567890-123456789.jpg`
- **Why string, not file**: MongoDB stores metadata, file is on disk

```javascript
owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
```
**What happens**:
- `ObjectId`: MongoDB's unique identifier type (24-character hex string)
- `ref: 'User'`: Tells Mongoose this references `User` collection
- **Why reference**: Links photo to user (one-to-many: one user → many photos)
- **Example**: `owner: ObjectId("674a1b2c3d4e5f6789abcdef")`

```javascript
}, { timestamps: true });
```
**What happens**: Adds `createdAt` and `updatedAt` automatically

### MongoDB Document Example

```json
{
  "_id": ObjectId("674b2c3d4e5f6789abcdef01"),
  "title": "Mountain View",
  "description": "Beautiful sunset over the mountains",
  "imageUrl": "/uploads/photo-1739234567890-123456789.jpg",
  "owner": ObjectId("674a1b2c3d4e5f6789abcdef"),
  "createdAt": ISODate("2024-01-15T11:00:00Z"),
  "updatedAt": ISODate("2024-01-15T11:00:00Z")
}
```

### Population (Advanced)

If you wanted to get user details with photo:
```javascript
Photo.findOne().populate('owner')  // Fetches User document and replaces ObjectId
```

---

## Module 6: middleware/auth.js

**Purpose**: Mock authentication - ensures every request has a "current user" by finding/creating a demo user.

### Deep Dive

```javascript
const User = require('../models/User');
```
**What happens**: Imports User model to query database

```javascript
const mockAuth = async (req, res, next) => {
```
**What happens**:
- `async`: Function can use `await` (needed for database queries)
- `req`: Request object (contains headers, body, params)
- `res`: Response object (used to send responses)
- `next`: Function to call next middleware/route handler

```javascript
try {
  let user = await User.findOne();
```
**What happens**:
- `User.findOne()`: Mongoose query - finds first user document (no filter = finds any)
- `await`: Waits for database query to complete
- **Returns**: User document object or `null` if no users exist
- **Database query**: `db.users.findOne({})` (MongoDB query)

```javascript
if (!user) {
  user = await User.create({
    username: 'demo-user',
    email: 'demo@example.com',
  });
}
```
**What happens**:
- **If no user exists**:
  1. `User.create({...})`: Creates new user document
  2. Mongoose validates schema (username/email required)
  3. MongoDB inserts document into `users` collection
  4. Returns created user document
- **Why create**: Ensures there's always a user for ownership

```javascript
req.user = { id: user._id.toString() };
```
**What happens**:
- `user._id`: MongoDB ObjectId (e.g., `ObjectId("674a1b2c3d4e5f6789abcdef")`)
- `.toString()`: Converts to string (e.g., `"674a1b2c3d4e5f6789abcdef"`)
- `req.user = { id: ... }`: Attaches user ID to request object
- **Why**: Route handlers can access `req.user.id` to set photo ownership

```javascript
next();
```
**What happens**:
- Calls next middleware/route handler
- **If not called**: Request hangs (no response sent)

```javascript
} catch (err) {
  res.status(500).json({ error: 'Auth setup failed' });
}
```
**What happens**:
- Catches database errors (connection failed, query error)
- `res.status(500)`: Sets HTTP status code 500 (Internal Server Error)
- `res.json({...})`: Sends JSON response
- **Why**: Prevents app crash, sends error to client

### Real Authentication (Production)

In production, you'd replace this with:
```javascript
const jwt = require('jsonwebtoken');
const token = req.headers.authorization?.split(' ')[1];  // "Bearer <token>"
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = { id: decoded.userId };
```

---

## Module 7: routes/photos.js

**Purpose**: Defines API endpoints for photo operations (upload, list, delete).

### Router Setup

```javascript
const router = express.Router();
router.use(mockAuth);
```
**What happens**:
- `express.Router()`: Creates router instance (handles routes)
- `router.use(mockAuth)`: Runs `mockAuth` middleware for **all routes** in this router
- **Effect**: Every route handler has `req.user.id` available

### Route 1: POST /api/photos (Upload)

```javascript
router.post('/', upload.single('image'), async (req, res) => {
```
**What happens**:
- `router.post('/')`: Handles `POST /api/photos` (router mounted at `/api/photos`)
- `upload.single('image')`: Multer middleware - expects one file in field named `'image'`
- **Middleware order**: `mockAuth` → `upload.single()` → route handler

```javascript
if (!req.file) {
  return res.status(400).json({ error: 'No image file provided.' });
}
```
**What happens**:
- `req.file`: Set by Multer if file uploaded successfully
- **If no file**: Client didn't send file or Multer rejected it
- `return`: Exits function early (prevents further execution)
- **400 Bad Request**: Client error (missing required data)

```javascript
const imageUrl = '/uploads/' + req.file.filename;
```
**What happens**:
- `req.file.filename`: Filename generated by Multer (e.g., `photo-1739234567890-123456789.jpg`)
- **Result**: `/uploads/photo-1739234567890-123456789.jpg`
- **Why this format**: Matches Express static route (`/uploads` → `backend/uploads/`)

```javascript
const photo = await Photo.create({
  title: req.body.title || 'Untitled',
  description: req.body.description || '',
  imageUrl,
  owner: req.user.id,
});
```
**What happens**:
- `req.body.title`: Form field value (set by Multer from multipart body)
- `|| 'Untitled'`: Default if title is empty/undefined
- `owner: req.user.id`: Sets owner to current user's ID (from `mockAuth`)
- `Photo.create({...})`: 
  1. Validates schema (required fields present, types correct)
  2. Inserts document into `photos` collection
  3. Returns created document (with `_id`, `createdAt`, etc.)
- `await`: Waits for database operation to complete

```javascript
res.status(201).json(photo);
```
**What happens**:
- `201 Created`: HTTP status for successful resource creation
- `res.json(photo)`: Converts photo object to JSON, sends as response body
- **Response**: `{ "_id": "...", "title": "...", "imageUrl": "...", ... }`

```javascript
} catch (err) {
  if (req.file) {
    try {
      await fs.unlink(req.file.path);
    } catch (e) {}
  }
```
**What happens**:
- **Error occurred**: Database error, validation error, etc.
- `req.file.path`: Full path to uploaded file (e.g., `backend/uploads/photo-123.jpg`)
- `fs.unlink(path)`: Deletes file from disk
- **Why cleanup**: Prevents orphaned files if database save fails
- **Nested try-catch**: Ignores file deletion errors (file might not exist)

```javascript
if (err.message && err.message.includes('allowed')) {
  return res.status(400).json({ error: err.message });
}
```
**What happens**:
- Checks if error is from fileFilter (rejected file type)
- `err.message`: Error message from Multer (e.g., "Only .jpg, .jpeg, and .png images are allowed.")
- **400 Bad Request**: Client sent invalid data

```javascript
if (err.code === 'LIMIT_FILE_SIZE') {
  return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
}
```
**What happens**:
- Checks if error is file size limit exceeded
- `err.code`: Multer error code for size limit
- **400 Bad Request**: Client sent file too large

```javascript
res.status(500).json({ error: 'Failed to save photo.' });
```
**What happens**:
- **Catch-all**: Any other error (database connection, validation, etc.)
- **500 Internal Server Error**: Server-side error

### Route 2: GET /api/photos (List)

```javascript
router.get('/', async (req, res) => {
```
**What happens**: Handles `GET /api/photos` request

```javascript
const photos = await Photo.find({ owner: req.user.id })
  .sort({ createdAt: -1 })
  .lean();
```
**What happens**:
- `Photo.find({ owner: req.user.id })`: 
  - Mongoose query builder
  - Filters photos where `owner` field equals current user's ID
  - **MongoDB query**: `db.photos.find({ owner: ObjectId("674a1b2c3d4e5f6789abcdef") })`
- `.sort({ createdAt: -1 })`: 
  - Sorts by `createdAt` descending (`-1` = newest first)
  - **MongoDB**: `.sort({ createdAt: -1 })`
- `.lean()`: 
  - Returns plain JavaScript objects (not Mongoose documents)
  - **Why**: Faster, smaller memory footprint, easier to JSON serialize
  - **Without lean**: Returns Mongoose documents with methods like `.save()`, `.populate()`

```javascript
res.json(photos);
```
**What happens**:
- Converts photos array to JSON
- **Response**: `[{ "_id": "...", "title": "...", ... }, { ... }, ...]`
- **Default status**: 200 OK

### Route 3: DELETE /api/photos/:id

```javascript
router.delete('/:id', async (req, res) => {
```
**What happens**: Handles `DELETE /api/photos/:id` (e.g., `DELETE /api/photos/674b2c3d4e5f6789abcdef01`)
- `:id`: Route parameter (captured in `req.params.id`)

```javascript
const photo = await Photo.findOne({ _id: req.params.id, owner: req.user.id });
```
**What happens**:
- `req.params.id`: Photo ID from URL (e.g., `"674b2c3d4e5f6789abcdef01"`)
- `Photo.findOne({ _id: ..., owner: ... })`: 
  - Finds photo with matching `_id` AND `owner`
  - **Why both**: Prevents users from deleting other users' photos
  - **Returns**: Photo document or `null` if not found

```javascript
if (!photo) {
  return res.status(404).json({ error: 'Photo not found.' });
}
```
**What happens**:
- **If photo doesn't exist**: Photo ID invalid or doesn't belong to user
- **404 Not Found**: Resource doesn't exist

```javascript
const filePath = path.join(__dirname, '..', 'uploads', path.basename(photo.imageUrl));
```
**What happens**:
- `photo.imageUrl`: `/uploads/photo-1739234567890-123456789.jpg`
- `path.basename(...)`: Extracts filename (`photo-1739234567890-123456789.jpg`)
- `path.join(__dirname, '..', 'uploads', ...)`: Builds full path (`backend/uploads/photo-...jpg`)
- **Why**: Need absolute path to delete file

```javascript
try {
  await fs.unlink(filePath);
} catch (e) {
  // ignore if file already missing
}
```
**What happens**:
- `fs.unlink(path)`: Deletes file from disk
- **Try-catch**: Ignores errors (file might already be deleted manually)
- **Why ignore**: Don't fail delete operation if file missing

```javascript
await Photo.deleteOne({ _id: req.params.id });
```
**What happens**:
- `Photo.deleteOne({ _id: ... })`: Deletes document from MongoDB
- **Why after file delete**: If file delete fails, we still try to delete document (better than leaving orphaned DB record)

```javascript
res.json({ message: 'Photo deleted.' });
```
**What happens**: Sends success response

---

## Operation 1: POST /api/photos - Complete Flow

### Request Example

```http
POST /api/photos HTTP/1.1
Host: localhost:5001
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW

------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="image"; filename="sunset.jpg"
Content-Type: image/jpeg

[Binary image data]
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="title"

Beautiful Sunset
------WebKitFormBoundary7MA4YWxkTrZu0gW
Content-Disposition: form-data; name="description"

Taken at the beach
------WebKitFormBoundary7MA4YWxkTrZu0gW--
```

### Step-by-Step Execution

| Step | Module | Action | Details |
|------|--------|--------|---------|
| 1 | Express | Request received | HTTP request arrives at Express server |
| 2 | CORS | Check origin | Validates `Origin` header, adds CORS headers |
| 3 | Router | Match route | `POST /api/photos` matches `router.post('/')` |
| 4 | auth.js | `mockAuth` runs | Finds/creates user, sets `req.user = { id: "..." }` |
| 5 | multer.js | `upload.single('image')` | Parses multipart body, validates file |
| 6 | multer.js | File validation | Checks MIME type (`image/jpeg`), file size (≤5MB) |
| 7 | multer.js | Save file | Writes file to `backend/uploads/photo-1739234567890-123456789.jpg` |
| 8 | multer.js | Set req.file | `req.file = { filename: "...", path: "...", size: ... }` |
| 9 | multer.js | Set req.body | `req.body = { title: "Beautiful Sunset", description: "..." }` |
| 10 | photos.js | Check req.file | Validates file exists |
| 11 | photos.js | Build imageUrl | `imageUrl = '/uploads/' + req.file.filename` |
| 12 | photos.js | Photo.create() | Inserts document into MongoDB `photos` collection |
| 13 | MongoDB | Validate schema | Checks required fields, types |
| 14 | MongoDB | Insert document | Creates document with `_id`, timestamps |
| 15 | photos.js | Send response | `201 Created` + photo JSON |

### Error Scenarios

**Scenario 1: Invalid file type**
- Multer `fileFilter` rejects → Multer calls `next(err)`
- Route handler skipped → Express error handler sends 400

**Scenario 2: File too large**
- Multer checks `limits.fileSize` → Rejects → 400 error

**Scenario 3: Database error**
- `Photo.create()` fails → Catch block runs
- File deleted from disk → 500 error sent

---

## Operation 2: GET /api/photos - Complete Flow

### Request Example

```http
GET /api/photos HTTP/1.1
Host: localhost:5001
```

### Step-by-Step Execution

| Step | Module | Action | Details |
|------|--------|--------|---------|
| 1 | Express | Request received | HTTP GET request |
| 2 | CORS | Check origin | Adds CORS headers |
| 3 | Router | Match route | `GET /api/photos` matches `router.get('/')` |
| 4 | auth.js | `mockAuth` runs | Sets `req.user.id` |
| 5 | photos.js | `Photo.find()` | Queries MongoDB: `db.photos.find({ owner: ObjectId("...") })` |
| 6 | MongoDB | Execute query | Scans `photos` collection, filters by `owner` |
| 7 | photos.js | `.sort()` | Sorts results by `createdAt` descending |
| 8 | photos.js | `.lean()` | Converts Mongoose docs → plain objects |
| 9 | photos.js | `res.json()` | Serializes array to JSON, sends response |

### MongoDB Query Execution

```javascript
// Mongoose query
Photo.find({ owner: req.user.id }).sort({ createdAt: -1 }).lean()

// Equivalent MongoDB query
db.photos.find({ owner: ObjectId("674a1b2c3d4e5f6789abcdef") })
  .sort({ createdAt: -1 })
```

**MongoDB execution**:
1. Uses index on `owner` (if exists) for fast lookup
2. Filters documents where `owner` matches
3. Sorts by `createdAt` descending
4. Returns array of documents

---

## Operation 3: DELETE /api/photos/:id - Complete Flow

### Request Example

```http
DELETE /api/photos/674b2c3d4e5f6789abcdef01 HTTP/1.1
Host: localhost:5001
```

### Step-by-Step Execution

| Step | Module | Action | Details |
|------|--------|--------|---------|
| 1 | Express | Request received | HTTP DELETE request |
| 2 | Router | Extract :id | `req.params.id = "674b2c3d4e5f6789abcdef01"` |
| 3 | auth.js | `mockAuth` runs | Sets `req.user.id` |
| 4 | photos.js | `Photo.findOne()` | Queries: `{ _id: ObjectId("..."), owner: ObjectId("...") }` |
| 5 | MongoDB | Find document | Returns photo document or `null` |
| 6 | photos.js | Check if found | If `null` → 404 error |
| 7 | photos.js | Build file path | `backend/uploads/photo-1739234567890-123456789.jpg` |
| 8 | fs module | `fs.unlink()` | Deletes file from disk |
| 9 | photos.js | `Photo.deleteOne()` | Deletes document from MongoDB |
| 10 | MongoDB | Remove document | Removes from `photos` collection |
| 11 | photos.js | Send response | `200 OK` + success message |

### Why Check Owner

**Security**: Without owner check, malicious user could:
1. Guess photo IDs: `DELETE /api/photos/674b2c3d4e5f6789abcdef01`
2. Delete other users' photos

**With owner check**: Only deletes if `owner` matches `req.user.id`

---

## Error Handling Deep Dive

### Error Types

1. **Client Errors (4xx)**:
   - `400 Bad Request`: Invalid file type, missing file, file too large
   - `404 Not Found`: Photo ID doesn't exist or doesn't belong to user

2. **Server Errors (5xx)**:
   - `500 Internal Server Error`: Database connection failed, validation error, unexpected error

### Error Propagation

```
Route handler throws error
  ↓
catch block catches
  ↓
Checks error type (file type, file size, etc.)
  ↓
Sends appropriate HTTP status + error message
  ↓
Client receives error response
```

### Cleanup on Error

**Upload error cleanup**:
```javascript
if (req.file) {
  await fs.unlink(req.file.path);  // Delete uploaded file
}
```
**Why**: Prevents orphaned files if database save fails

---

## Memory Management & File Handling

### File Storage Strategy

**Why disk storage (not memory)**:
- Memory storage (`multer.memoryStorage()`) loads entire file into RAM
- 5MB file × 100 concurrent uploads = 500MB RAM
- Disk storage streams file directly to disk (minimal RAM usage)

### File Naming Strategy

**Unique filenames prevent**:
- Overwrites if two users upload `image.jpg` simultaneously
- Security issues (predictable filenames)

**Format**: `photo-<timestamp>-<random>.<ext>`
- Timestamp: Ensures chronological ordering
- Random: Adds extra uniqueness
- Extension: Preserves original file type

### MongoDB ObjectId

**Format**: 24-character hexadecimal string
- Example: `674a1b2c3d4e5f6789abcdef`
- **Structure**: 
  - First 8 chars: Timestamp
  - Next 6 chars: Machine identifier
  - Next 4 chars: Process ID
  - Last 6 chars: Counter

**Why ObjectId**:
- Globally unique (no collisions)
- Sortable (contains timestamp)
- Efficient (12 bytes vs UUID's 16 bytes)

---

## Security Considerations

### Current Implementation

✅ **File type validation**: Only allows image MIME types
✅ **File size limits**: Prevents huge files
✅ **Owner verification**: Users can only delete their own photos
✅ **Unique filenames**: Prevents filename collisions

### Potential Vulnerabilities

⚠️ **No file content validation**: Could upload malicious image files (steganography)
⚠️ **No rate limiting**: Users could spam uploads
⚠️ **No authentication**: Anyone can access API (mock auth)
⚠️ **Path traversal**: Filename could contain `../` (mitigated by `path.basename()`)

### Production Recommendations

1. **Real authentication**: JWT tokens, session management
2. **File content scanning**: Validate actual image content (not just extension)
3. **Rate limiting**: Limit uploads per user/IP
4. **File size per user**: Track total storage per user
5. **Image processing**: Resize/compress images server-side
6. **CDN**: Serve images from CDN (not Express static)

---

## Summary

This backend implements a **RESTful API** for photo management:

- **POST /api/photos**: Upload photo (file + metadata) → saves to disk + MongoDB
- **GET /api/photos**: List user's photos → queries MongoDB, returns JSON
- **DELETE /api/photos/:id**: Delete photo → removes file + MongoDB document

**Key technologies**:
- Express.js: HTTP server framework
- Mongoose: MongoDB ODM (Object Document Mapper)
- Multer: File upload middleware
- MongoDB: NoSQL document database

**Architecture**:
- Separation of concerns (models, routes, middleware, config)
- Error handling with cleanup
- Security through validation and owner checks

This completes the deep dive explanation of every module and operation!
