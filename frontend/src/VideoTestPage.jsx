// VideoTestPage.jsx
// URL eka paste karala play wenawada kiyala test karana page eka.
// App.jsx eke: import VideoTestPage from "./VideoTestPage";  ->  <VideoTestPage />

import { useState, useCallback } from "react";
import SecureYouTubePlayer, { getYouTubeId } from "./SecureYouTubePlayer";

export default function VideoTestPage() {
  const [input, setInput] = useState("");
  const [url, setUrl] = useState("");
  const [log, setLog] = useState([]);

  const onStatus = useCallback((type, msg) => {
    setLog((l) => [{ type, msg, t: new Date().toLocaleTimeString() }, ...l].slice(0, 8));
  }, []);

  const submit = (e) => {
    e.preventDefault();
    setLog([]);
    setUrl(input);
  };

  const id = getYouTubeId(input);
  const colors = { ready: "#4f8cff", playing: "#2ecc71", buffering: "#f1c40f", error: "#e74c3c" };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>YouTube Player Test</h2>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#666" }}>
            Paste any unlisted or public YouTube link to test embedding and status.
          </p>
        </div>
      </div>

      <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          id="yt-url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... / youtu.be/... / shorts/..."
          style={{ flex: 1, minWidth: 260, padding: "12px 14px", fontSize: 15, borderRadius: 10, border: "1px solid #ccc", outline: "none" }}
        />
        <button 
          type="submit" 
          disabled={!id}
          style={{ 
            padding: "12px 22px", 
            fontSize: 15, 
            fontWeight: "bold", 
            borderRadius: 10, 
            border: 0, 
            background: id ? "#e11d48" : "#ccc", 
            color: "#fff", 
            cursor: id ? "pointer" : "not-allowed",
            transition: "all 0.2s"
          }}
        >
          Load Video
        </button>
      </form>
      
      <div style={{ fontSize: 13, color: id ? "#16a34a" : "#888", marginBottom: 20, fontWeight: 500 }}>
        {input ? (id ? `✓ Valid Video ID: ${id}` : "Link eka hoyaganna ba (invalid link format)") : "YouTube unlisted hari public link ekak paste karanna"}
      </div>

      {url && (
        <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
          <SecureYouTubePlayer url={url} onStatus={onStatus} />
        </div>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: 24, background: "#f8fafc", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>Status Logs</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
            {log.map((l, i) => (
              <li key={i} style={{ padding: "8px 0", borderBottom: i === log.length - 1 ? "none" : "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{l.t}</span>
                <span style={{ 
                  color: "#fff", 
                  background: colors[l.type] || "#64748b", 
                  padding: "2px 8px", 
                  borderRadius: 6, 
                  fontSize: 11, 
                  fontWeight: "bold", 
                  textTransform: "uppercase" 
                }}>
                  {l.type}
                </span>
                <span style={{ color: "#1e293b", fontWeight: 500 }}>{l.msg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
