import { useEffect, useState } from "react";
import { api, type AdminImage } from "../api";
import RefreshButton from "./RefreshButton";

export default function AdminImages() {
  const [images, setImages] = useState<AdminImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    api
      .adminListImages(1, 50)
      .then((r) => setImages(r.images))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load images"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const uploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      await api.adminUploadImage(form);
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const uploadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await api.adminUploadImage({ source_url: url.trim() });
      setUrl("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this image? Anything still referencing its URL will break.")) return;
    await api.adminDeleteImage(id);
    load();
  };

  const copyUrl = (id: number) => {
    const fullUrl = `${window.location.origin}/images/${id}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    });
  };

  return (
    <div className="admin-dashboard">
      <h1>Images</h1>
      <p className="admin-subtitle">
        Upload images to use as story covers or chapter illustrations, then copy the URL into that story/chapter's
        image field.
      </p>

      <div className="admin-card">
        <h2>Upload</h2>
        <form onSubmit={uploadFile} className="admin-inline-form">
          <label>
            From your device
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={!file || uploading}>
            {uploading ? "Uploading…" : "Upload file"}
          </button>
        </form>
        <form onSubmit={uploadUrl} className="admin-inline-form">
          <label>
            From a URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </label>
          <button type="submit" disabled={!url.trim() || uploading}>
            {uploading ? "Fetching…" : "Fetch from URL"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="admin-list-heading-row">
        <h2 className="admin-list-heading">Uploaded images ({images.length})</h2>
        <RefreshButton onClick={load} loading={loading} />
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : images.length === 0 ? (
        <p className="admin-empty">No images uploaded yet.</p>
      ) : (
        <div className="admin-image-grid">
          {images.map((img) => (
            <div key={img.id} className="admin-image-card">
              <div className="admin-image-thumb-wrap">
                <img src={`/images/${img.id}`} alt={img.filename ?? ""} className="admin-image-thumb-full" />
              </div>
              <div className="admin-image-meta">
                <div className="admin-image-name">{img.filename || `Image #${img.id}`}</div>
                {img.content_type && <span className="admin-badge">{img.content_type}</span>}
              </div>
              <div className="admin-row-actions">
                <button type="button" className="admin-btn-ghost" onClick={() => copyUrl(img.id)}>
                  {copiedId === img.id ? "Copied ✓" : "Copy URL"}
                </button>
                <button type="button" className="admin-btn-danger" onClick={() => remove(img.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
