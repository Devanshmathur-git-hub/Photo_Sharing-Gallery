# Photo Sharing / Gallery

A full-stack MERN photo gallery: Node.js/Express backend with Multer uploads and MongoDB, and a React + Bootstrap frontend.

## Tech stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), Multer
- **Frontend:** React, Axios, Bootstrap, Vite

## Prerequisites

- Node.js (v18+)
- MongoDB running locally (e.g. `mongodb://127.0.0.1:27017`) or a remote URI

## Setup

1. **Install dependencies (root + backend + frontend):**

   ```bash
   npm run install:all
   ```

   Or manually:

   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Environment (optional):**

   In the project root or in `backend/`, create a `.env` file:

   ```env
   PORT=5001
   MONGODB_URI=mongodb://127.0.0.1:27017/photo-gallery
   FRONTEND_URL=http://localhost:5173
   ```

   If you omit `.env`, the app uses the defaults above.

## Run the app

### Option A: Run both servers with one command (recommended)

From the project root:

```bash
npm run dev
```

This starts:

- **Backend** at `http://localhost:5001`
- **Frontend** at `http://localhost:5173` (Vite dev server with proxy to the API)

Open [http://localhost:5173](http://localhost:5173) in your browser.

The backend uses port **5001** by default to avoid conflict with macOS AirPlay Receiver (which uses 5000). If 5001 is in use, set `PORT` in `.env` to another port and update the frontend proxy in `frontend/vite.config.js` to match.

### Option B: Run backend and frontend in separate terminals

**Terminal 1 – backend:**

```bash
npm run backend
```

**Terminal 2 – frontend:**

```bash
npm run frontend
```

Then open [http://localhost:5173](http://localhost:5173).

## Project structure

- **backend/** – Express API, Mongoose models, Multer config, photo routes
- **frontend/** – React app (Vite), `Gallery`, `UploadForm`, `PhotoCard` components

## API (backend)

- `POST /api/photos` – Upload image (multipart/form-data: `image`, `title`, `description`). Max 5MB; allowed: `.jpg`, `.jpeg`, `.png`.
- `GET /api/photos` – List photos for the current (mock) user.
- `DELETE /api/photos/:id` – Delete a photo and its file.

Auth is mocked via middleware that assigns a single demo user; all requests use that user.

## Features

- Upload images with title and description
- Responsive grid (Bootstrap) for the gallery
- Delete photos (removes DB record and file from `backend/uploads/`)
- Loading and error feedback (spinner on upload/delete, toasts/alerts)
- Client-side checks for file type and 5MB limit


