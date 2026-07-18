import { useEffect, useState } from "react";
import { api } from "../api";

export default function AdminImages() {
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.adminListImages(1, 50);
      setImages(res.images ?? []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFile = (f: File | null) => setFile(f);

  const uploadFile = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file, file.name);
    await api.adminUploadImage(form);
    setFile(null);
    load();
  };

  const uploadUrl = async () => {
    if (!url) return;
    await api.adminUploadImage({ source_url: url });
    setUrl("");
    load();
  };

  const remove = async (id: number) => {
    await api.adminDeleteImage(id);
    load();
  };

  return (
    <div>
      <h2>Images</h2>
      <div style={{ marginBottom: 16 }}>
        <input type="file" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <button onClick={uploadFile} disabled={!file}>
          Upload File
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Image URL to fetch" style={{ width: 400 }} />
        <button onClick={uploadUrl} disabled={!url}>
          Upload from URL
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {images.map((img) => (
            <li key={img.id} style={{ marginBottom: 12 }}>
              <div>
                <img src={`/images/${img.id}`} alt={img.filename ?? "image"} style={{ maxWidth: 200, display: "block" }} />
                <div>{img.filename}</div>
                <div>{img.content_type}</div>
                <button onClick={() => remove(img.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
