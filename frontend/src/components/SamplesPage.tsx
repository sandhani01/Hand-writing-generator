import { useEffect, useState } from "react";
import { apiClient } from "../api";

type Props = {
  onBack: () => void;
};

export function SamplesPage({ onBack }: Props) {
  const [samples, setSamples] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSamples = async () => {
      try {
        setError(null);
        const data = await apiClient.get<{ items: string[] }>("/api/v1/samples");
        setSamples(data.items);
      } catch (err) {
        console.error("Failed to fetch samples:", err);
        setError("Could not connect to the sample library.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSamples();
  }, []);

  return (
    <div className="samples-page-wrapper">
      <div className="gate-background">
        <div className="gate-background__glow" />
      </div>
      
      <div className="app app--samples">
        <header className="samples-header">
          <div className="samples-header__content">
            <button onClick={onBack} className="samples-back-btn" aria-label="Back to selection">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="samples-header__text">
              <h1 className="samples-title">Handwriting Samples</h1>
            </div>
          </div>
        </header>

        <main className="samples-grid">
          {isLoading ? (
            <div className="samples-loading">
              <div className="samples-loading__spinner" />
              <span>Fetching latest samples...</span>
            </div>
          ) : error ? (
            <div className="samples-error">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <p className="samples-error-detail">Please ensure the backend server is running on port 8000.</p>
              <button onClick={() => window.location.reload()} className="samples-retry-btn">Retry</button>
            </div>
          ) : samples.length === 0 ? (
            <div className="samples-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              <span>No samples found in the folder.</span>
              <p>Add images to <code>frontend/public/Samples</code> to see them here.</p>
            </div>
          ) : (
            samples.map((src, index) => (
              <div 
                key={index} 
                className="sample-item" 
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => setPreviewImage(src)}
              >
                <div className="sample-item__image-container">
                  <img src={src} alt={`Handwriting Sample ${index + 1}`} className="sample-item__img" loading="lazy" />
                  <div className="sample-item__view-overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.3-4.3"/>
                    </svg>
                    <span>View Preview</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      </div>

      {previewImage && (
        <div className="sample-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="sample-preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="sample-preview-close" onClick={() => setPreviewImage(null)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <img src={previewImage} alt="Sample Preview" className="sample-preview-image" />
          </div>
        </div>
      )}
    </div>
  );
}
