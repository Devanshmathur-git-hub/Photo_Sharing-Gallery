import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import UploadForm from './UploadForm';
import PhotoCard from './PhotoCard';

const API_BASE = '';

function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/api/photos`);
      setPhotos(Array.isArray(data) ? data : []);
    } catch (err) {
      setToastMessage({ type: 'danger', text: err.response?.data?.error || 'Failed to load photos.' });
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleUpload = async ({ file, title, description }) => {
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', title);
    formData.append('description', description);
    try {
      await axios.post(`${API_BASE}/api/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setToastMessage({ type: 'success', text: 'Photo uploaded.' });
      fetchPhotos();
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed.';
      setUploadError(msg);
      setToastMessage({ type: 'danger', text: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`${API_BASE}/api/photos/${id}`);
      setToastMessage({ type: 'success', text: 'Photo deleted.' });
      setPhotos((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setToastMessage({ type: 'danger', text: err.response?.data?.error || 'Delete failed.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="gallery-page">
      <header className="gallery-hero">
        <h1>Photo Gallery</h1>
        <p>Upload and manage your photos</p>
      </header>

      <div className="container">
        <UploadForm
          onUpload={handleUpload}
          uploading={uploading}
          error={uploadError}
          clearError={() => setUploadError('')}
        />

        {toastMessage && (
          <div className="toast-container-custom">
            <div className={`toast show align-items-center text-bg-${toastMessage.type} border-0`} role="alert">
              <div className="d-flex">
                <div className="toast-body">{toastMessage.text}</div>
                <button
                  type="button"
                  className="btn-close btn-close-white me-2 m-auto"
                  aria-label="Close"
                  onClick={() => setToastMessage(null)}
                />
              </div>
            </div>
          </div>
        )}

        <section>
          <h2 className="gallery-section-title">Your photos</h2>
          {loading ? (
            <div className="gallery-loading">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading…</span>
              </div>
            </div>
          ) : photos.length === 0 ? (
            <div className="gallery-empty">
              <svg className="gallery-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p>No photos yet. Drop an image above to get started.</p>
            </div>
          ) : (
            <div className="row g-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo._id}
                  photo={photo}
                  onDelete={handleDelete}
                  deleting={deletingId === photo._id}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Gallery;
