const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const Photo = require('../models/Photo');
const upload = require('../config/multer');
const { mockAuth } = require('../middleware/auth');

const router = express.Router();
router.use(mockAuth);

// POST /api/photos - upload image and save metadata
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    const imageUrl = '/uploads/' + req.file.filename;
    const photo = await Photo.create({
      title: req.body.title || 'Untitled',
      description: req.body.description || '',
      imageUrl,
      owner: req.user.id,
    });
    res.status(201).json(photo);
  } catch (err) {
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {}
    }
    if (err.message && err.message.includes('allowed')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: 'Failed to save photo.' });
  }
});

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
