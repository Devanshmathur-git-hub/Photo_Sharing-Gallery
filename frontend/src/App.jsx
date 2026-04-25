import Gallery from './components/Gallery';

function App() {
  return (
    <div className="min-vh-100 gallery-app">
      <Gallery />
      <footer className="gallery-footer">
        <a
          className="gallery-footer-link"
          href="https://github.com/Devanshmathur-git-hub/Photo_Sharing-Gallery"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </div>
  );
}

export default App;
