const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const Photo = require('../models/Photo');
const upload = require('../config/multer');
const { mockAuth } = require('../middleware/auth');

const router = express.Router();
router.use(mockAuth);

/* POST /api/photos — Upload photo (Full execution flow)

Code:
router.post('/', upload.single('image'), async (req, res)


This handles:
POST /api/photos


Execution flow step-by-step:

Step 1: Request arrives
Frontend sends:
POST /api/photos
with:
image file
title
description

Step 2: mockAuth runs
mockAuth sets:
req.user.id
Example:
req.user.id = "abc123"

Step 3: multer runs
upload.single('image')
Multer does:
reads file from request
checks file type
checks file size
saves file in uploads folder
Example saved file:
uploads/photo-999.jpg
Then multer sets:
req.file
req.body

Example:
req.file.filename = photo-999.jpg
req.body.title = "My photo"

Step 4: Check file exists
if (!req.file)
If file missing → send error.

Step 5: Create image URL
const imageUrl = '/uploads/' + req.file.filename;
Example:
/uploads/photo-999.jpg
Frontend uses this URL.

Step 6: Save data in MongoDB
const photo = await Photo.create({
This stores data in database.
MongoDB stores:
{
 title: "My photo",
 description: "Nice view",
 imageUrl: "/uploads/photo-999.jpg",
 owner: "abc123"
}

Step 7: Send response
res.status(201).json(photo);
Frontend receives photo info.
Upload complete.  */

// POST /api/photos - upload one or multiple images and save metadata
const MAX_FILES = 20;
router.post('/', upload.array('image', MAX_FILES), async (req, res) => {
  const files = req.files || [];
  try {
    if (files.length === 0) {
      return res.status(400).json({ error: 'No image file(s) provided.' });
    }
    const baseTitle = req.body.title?.trim() || 'Untitled';
    const description = req.body.description?.trim() || '';
    const created = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = '/uploads/' + file.filename;
      const title = files.length > 1 ? `${baseTitle} (${i + 1})` : baseTitle;
      const photo = await Photo.create({
        title,
        description,
        imageUrl,
        owner: req.user.id,
      });
      created.push(photo);
    }
    res.status(201).json(created.length === 1 ? created[0] : created);
  } catch (err) {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
      } catch (e) {}
    }
    if (err.message && err.message.includes('allowed')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB per file.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: `Maximum ${MAX_FILES} files per upload.` });
    }
    const message = err.message || 'Failed to save photo(s).';
    res.status(500).json({ error: message });
  }
});

/* GET /api/photos — Get photos flow. Execution flow:

Step 1: Request arrives
Frontend sends:
GET /api/photos

Step 2: mockAuth runs
Sets:
req.user.id

Step 3: Query MongoDB
Photo.find({ owner: req.user.id })
Gets only user’s photos.

Step 4: Sort photos
.sort({ createdAt: -1 })
Newest first.

Step 5: Send response
res.json(photos);

Frontend receives photo list.*/

// GET /api/photos - all photos for current user
router.get('/', async (req, res) => {
  try {
    const photos = await Photo.find({ owner: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch photos.' });
  }
});

/* DELETE /api/photos/:id — Find photo by id+owner, fs.unlink(file), Photo.deleteOne(), res.json(). */

// DELETE /api/photos/:id - delete photo and file
router.delete('/:id', async (req, res) => {
  try {
    const photo = await Photo.findOne({ _id: req.params.id, owner: req.user.id });
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found.' });
    }
    const filePath = path.join(__dirname, '..', 'uploads', path.basename(photo.imageUrl));
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // ignore if file already missing
    }
    await Photo.deleteOne({ _id: req.params.id });
    res.json({ message: 'Photo deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo.' });
  }
});

module.exports = router;
