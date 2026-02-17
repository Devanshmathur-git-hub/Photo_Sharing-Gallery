function PhotoCard({ photo, onDelete, deleting }) {
  const handleDelete = (e) => {
    e.preventDefault();
    if (window.confirm('Delete this photo?')) {
      onDelete(photo._id);
    }
  };

  return (
    <div className="col-12 col-sm-6 col-md-4 col-lg-3">
      <div className="card gallery-card">
        <div className="card-img-wrap">
          <img
            src={photo.imageUrl}
            className="card-img-top"
            alt={photo.title}
            loading="lazy"
          />
        </div>
        <div className="card-body d-flex flex-column">
          <h3 className="card-title">{photo.title}</h3>
          {photo.description && (
            <p className="card-text">{photo.description}</p>
          )}
          <button
            type="button"
            className="btn btn-delete align-self-start mt-auto"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PhotoCard;
