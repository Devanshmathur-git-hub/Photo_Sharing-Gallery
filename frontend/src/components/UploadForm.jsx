import { useState, useRef } from 'react';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ACCEPT_STR = '.jpg,.jpeg,.png,image/jpeg,image/png';

function validateFile(file) {
  if (!file) return null;
  if (!ALLOWED_TYPES.includes(file.type))
    return 'Only .jpg, .jpeg, and .png images are allowed.';
  if (file.size > MAX_SIZE_BYTES)
    return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
  return null;
}

function UploadForm({ onUpload, uploading, error, clearError }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const setFileWithPreview = (newFile) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(newFile);
    if (newFile) setPreviewUrl(URL.createObjectURL(newFile));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    setFileError('');
    clearError?.();
    if (!selected) {
      setFileWithPreview(null);
      return;
    }
    const err = validateFile(selected);
    if (err) {
      setFileError(err);
      setFileWithPreview(null);
      return;
    }
    setFileWithPreview(selected);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setFileError('');
    clearError?.();
    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;
    const err = validateFile(dropped);
    if (err) {
      setFileError(err);
      setFileWithPreview(null);
      return;
    }
    setFileWithPreview(dropped);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setFileError('Please select or drop an image.');
      return;
    }
    onUpload({ file, title: title.trim() || 'Untitled', description: description.trim() });
    setTitle('');
    setDescription('');
    setFileWithPreview(null);
    setFileError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const clearFile = () => {
    setFileWithPreview(null);
    setFileError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const displayError = error || fileError;

  return (
    <div className="upload-card">
      <div className="upload-card-body">
        <h2 className="upload-title">Upload a photo</h2>
        <p className="upload-subtitle">Drag & drop or click to choose</p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="file"
            className="d-none"
            id="image"
            accept={ACCEPT_STR}
            onChange={handleFileChange}
            disabled={uploading}
          />

          <div
            className={`drop-zone ${isDragging ? 'drop-zone--active' : ''} ${file ? 'drop-zone--has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
          >
            {file && previewUrl ? (
              <div className="drop-zone-preview">
                <img src={previewUrl} alt="Preview" />
                <div className="drop-zone-preview-info">
                  <span className="drop-zone-filename">{file.name}</span>
                  <span className="drop-zone-size">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  type="button"
                  className="drop-zone-remove"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  disabled={uploading}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                </div>
                <p className="drop-zone-text">Drop your image here</p>
                <p className="drop-zone-hint">JPG, PNG up to {MAX_SIZE_MB}MB</p>
              </>
            )}
          </div>

          <div className="upload-fields">
            <div className="form-floating mb-3">
              <input
                type="text"
                className="form-control"
                id="title"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
              />
              <label htmlFor="title">Title</label>
            </div>
            <div className="form-floating mb-3">
              <textarea
                className="form-control"
                id="description"
                placeholder="Description"
                rows="2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={uploading}
              />
              <label htmlFor="description">Description (optional)</label>
            </div>
          </div>

          {displayError && (
            <div className="upload-error" role="alert">
              {displayError}
            </div>
          )}

          <button type="submit" className="btn-upload" disabled={uploading || !file}>
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              'Upload photo'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UploadForm;
