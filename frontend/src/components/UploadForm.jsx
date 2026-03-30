import { useState, useRef, useEffect } from 'react';

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ACCEPT_STR = '.jpg,.jpeg,.png,image/jpeg,image/png';
const MAX_FILES = 20;

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
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const setFilesWithPreviews = (newFiles) => {
    const list = Array.isArray(newFiles) ? [...newFiles] : newFiles ? [newFiles] : [];
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    const urls = list.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    setFiles(list);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files;
    setFileError('');
    clearError?.();
    if (!selected?.length) {
      setFilesWithPreviews([]);
      return;
    }
    const list = Array.from(selected).slice(0, MAX_FILES);
    if (Array.from(selected).length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files. Only first ${MAX_FILES} selected.`);
    }
    for (const file of list) {
      const err = validateFile(file);
      if (err) {
        setFileError(err);
        setFilesWithPreviews([]);
        return;
      }
    }
    setFilesWithPreviews(list);
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
    const dropped = e.dataTransfer?.files;
    if (!dropped?.length) return;
    const list = Array.from(dropped).filter((f) => f.type.startsWith('image/')).slice(0, MAX_FILES);
    if (list.length === 0) {
      setFileError('Only .jpg, .jpeg, and .png images are allowed.');
      return;
    }
    for (const file of list) {
      const err = validateFile(file);
      if (err) {
        setFileError(err);
        setFilesWithPreviews([]);
        return;
      }
    }
    setFilesWithPreviews(list);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setFileError('Please select or drop one or more images.');
      return;
    }
    onUpload({ files, title: title.trim() || 'Untitled', description: description.trim() });
    setTitle('');
    setDescription('');
    setFilesWithPreviews([]);
    setFileError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(newUrls);
    setFiles(newFiles);
    setFileError('');
  };

  const clearAll = () => {
    setFilesWithPreviews([]);
    setFileError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const displayError = error || fileError;

  return (
    <div className="upload-card">
      <div className="upload-card-body">
        <h2 className="upload-title">Upload photos</h2>
        <p className="upload-subtitle">Drag & drop or click to choose (up to {MAX_FILES} images)</p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="file"
            className="d-none"
            id="image"
            accept={ACCEPT_STR}
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />

          <div
            className={`drop-zone ${isDragging ? 'drop-zone--active' : ''} ${files.length ? 'drop-zone--has-file' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !files.length && inputRef.current?.click()}
          >
            {files.length > 0 ? (
              <div className="drop-zone-multi">
                <div className="drop-zone-multi-previews">
                  {files.slice(0, 5).map((file, i) => (
                    <div key={i} className="drop-zone-preview-item">
                      <img src={previewUrls[i]} alt="" />
                      <span className="drop-zone-preview-name">{file.name}</span>
                      <button
                        type="button"
                        className="drop-zone-remove"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        disabled={uploading}
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {files.length > 5 && (
                  <p className="drop-zone-more">+{files.length - 5} more</p>
                )}
                <div className="drop-zone-multi-actions">
                  <span className="drop-zone-count">{files.length} file(s) selected</span>
                  <button
                    type="button"
                    className="drop-zone-clear"
                    onClick={(e) => { e.stopPropagation(); clearAll(); }}
                    disabled={uploading}
                  >
                    Clear all
                  </button>
                </div>
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
                <p className="drop-zone-text">Drop your images here</p>
                <p className="drop-zone-hint">JPG, PNG up to {MAX_SIZE_MB}MB each · max {MAX_FILES} files</p>
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
              <label htmlFor="title">Title (used for all)</label>
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
              <label htmlFor="description">Description (optional, for all)</label>
            </div>
          </div>

          {displayError && (
            <div className="upload-error" role="alert">
              {displayError}
            </div>
          )}

          <button type="submit" className="btn-upload" disabled={uploading || !files.length}>
            {uploading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              files.length > 1 ? `Upload ${files.length} photos` : 'Upload photo'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default UploadForm;


