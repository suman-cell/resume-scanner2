"use client";
import { useState, useRef, useEffect } from "react";

const RING_RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function Gauge({ score }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const duration = 1100;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color = score >= 75 ? "var(--teal)" : score >= 45 ? "var(--amber)" : "var(--danger)";
  const offset = CIRCUMFERENCE * (1 - display / 100);

  return (
    <svg width="220" height="220" viewBox="0 0 220 220">
      <circle cx="110" cy="110" r={RING_RADIUS} fill="none" stroke="var(--panel-line)" strokeWidth="12" />
      <circle
        cx="110"
        cy="110"
        r={RING_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 110 110)"
        style={{ transition: "stroke 0.4s ease" }}
      />
      <text x="110" y="102" textAnchor="middle" className="mono" fontSize="42" fontWeight="700" fill="var(--text)">
        {display}
      </text>
      <text x="110" y="128" textAnchor="middle" className="mono" fontSize="13" fill="var(--text-dim)">
        MATCH SCORE
      </text>
    </svg>
  );
}

function Chip({ children, tone, delay }) {
  const styles = {
    matched: { background: "var(--teal-dim)", color: "var(--teal)", border: "1px solid var(--teal)" },
    missing: { background: "var(--danger-dim)", color: "var(--danger)", border: "1px solid var(--danger)" },
  };
  return (
    <span
      className="chip-in mono"
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 13,
        marginRight: 8,
        marginBottom: 8,
        animationDelay: `${delay}ms`,
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

const HISTORY_KEY = "signal-check-history";

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveToHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 8)));
  return history.slice(0, 8);
}

function buildReportText(result) {
  const lines = [
    "SIGNAL CHECK — RESUME MATCH REPORT",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    `MATCH SCORE: ${result.matchScore}/100`,
    `VERDICT: ${result.verdict}`,
    "",
    "MATCHED KEYWORDS:",
    (result.matchedKeywords || []).map((k) => `  - ${k}`).join("\n") || "  none",
    "",
    "MISSING KEYWORDS:",
    (result.missingKeywords || []).map((k) => `  - ${k}`).join("\n") || "  none",
    "",
    "SUGGESTIONS:",
    (result.suggestions || []).map((s, i) => `  ${i + 1}. ${s}`).join("\n") || "  none",
  ];
  return lines.join("\n");
}

export default function Page() {
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("signal-check-theme") || "dark";
    setTheme(saved);
    document.body.setAttribute("data-theme", saved);
    setHistory(loadHistory());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("signal-check-theme", next);
  }

  async function runScan() {
    setError(null);
    setResult(null);
    if (!resume.trim() || !jd.trim()) {
      setError("Paste both your resume and the job description first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data);
      setHistory(
        saveToHistory({
          time: new Date().toISOString(),
          matchScore: data.matchScore,
          verdict: data.verdict,
        })
      );
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copySuggestions() {
    if (!result) return;
    navigator.clipboard.writeText(buildReportText(result));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([buildReportText(result)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-check-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "64px 24px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48, gap: 20 }}>
        <div>
          <div className="mono" style={{ color: "var(--amber)", fontSize: 13, letterSpacing: "0.12em", marginBottom: 12 }}>
            SIGNAL CHECK
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.1, margin: 0, maxWidth: 720 }}>
            Will this resume clear the scan?
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: 17, maxWidth: 560, marginTop: 16, lineHeight: 1.6 }}>
            Paste your resume and a job description. Get an ATS-style read on your match, before a real one gives you a silent rejection.
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="mono"
          aria-label="Toggle light or dark theme"
          style={{
            flexShrink: 0,
            background: "var(--panel)",
            border: "1px solid var(--panel-line)",
            color: "var(--text)",
            borderRadius: 999,
            width: 44,
            height: 44,
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, letterSpacing: "0.08em", marginBottom: 10 }}>
            RECENT SCANS
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {history.map((h, i) => (
              <div
                key={i}
                className="mono"
                title={new Date(h.time).toLocaleString()}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--panel-line)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: "var(--text-dim)",
                }}
              >
                <span style={{ color: h.matchScore >= 75 ? "var(--teal)" : h.matchScore >= 45 ? "var(--amber)" : "var(--danger)", fontWeight: 700 }}>
                  {h.matchScore}
                </span>{" "}
                · {new Date(h.time).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, position: "relative" }}>
        <Panel label="RESUME" value={resume} onChange={setResume} loading={loading} />
        <Panel label="JOB DESCRIPTION" value={jd} onChange={setJd} loading={loading} />
      </div>

      {error && (
        <div className="fade-up" style={{ marginTop: 20, color: "var(--danger)", fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
        <button
          onClick={runScan}
          disabled={loading}
          className="mono"
          style={{
            background: loading ? "var(--panel-line)" : "var(--amber)",
            color: loading ? "var(--text-dim)" : "#0d1321",
            border: "none",
            borderRadius: 999,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: loading ? "default" : "pointer",
            transition: "transform 0.15s ease, background 0.2s ease",
          }}
          onMouseDown={(e) => !loading && (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {loading ? "SCANNING…" : "RUN SCAN ▸"}
        </button>
      </div>

      {result && (
        <div ref={resultRef} className="fade-up" style={{ marginTop: 64, paddingTop: 48, borderTop: "1px solid var(--panel-line)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 40, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Gauge score={result.matchScore} />
              <div style={{ marginTop: 8, textAlign: "center", color: "var(--text)", fontSize: 15, maxWidth: 200 }}>
                {result.verdict}
              </div>
            </div>

            <div>
              <Section title="MATCHED KEYWORDS">
                {result.matchedKeywords?.map((k, i) => (
                  <Chip key={k} tone="matched" delay={i * 40}>{k}</Chip>
                ))}
                {!result.matchedKeywords?.length && <Dim>None found</Dim>}
              </Section>

              <Section title="MISSING KEYWORDS">
                {result.missingKeywords?.map((k, i) => (
                  <Chip key={k} tone="missing" delay={i * 40}>{k}</Chip>
                ))}
                {!result.missingKeywords?.length && <Dim>Nothing critical missing</Dim>}
              </Section>

              <Section title="SUGGESTIONS">
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)", lineHeight: 1.8 }}>
                  {result.suggestions?.map((s, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>{s}</li>
                  ))}
                </ul>
              </Section>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={copySuggestions} className="mono" style={ghostButton}>
                  {copied ? "✓ COPIED" : "COPY REPORT"}
                </button>
                <button onClick={downloadReport} className="mono" style={ghostButton}>
                  DOWNLOAD .TXT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Panel({ label, value, onChange, loading }) {
  return (
    <div style={{ position: "relative", background: "var(--panel)", border: "1px solid var(--panel-line)", borderRadius: 14, padding: 16, overflow: "hidden" }}>
      <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, letterSpacing: "0.08em", marginBottom: 10 }}>
        {label}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label === "RESUME" ? "Paste your resume text here…" : "Paste the job description here…"}
        style={{
          width: "100%",
          height: 260,
          background: "transparent",
          border: "none",
          resize: "vertical",
          color: "var(--text)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      />
      {loading && <div className="scan-line" style={{ top: 0 }} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="mono" style={{ color: "var(--text-dim)", fontSize: 12, letterSpacing: "0.08em", marginBottom: 10 }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Dim({ children }) {
  return <span style={{ color: "var(--text-dim)", fontSize: 14 }}>{children}</span>;
}

const ghostButton = {
  background: "transparent",
  border: "1px solid var(--panel-line)",
  color: "var(--text-dim)",
  borderRadius: 999,
  padding: "8px 16px",
  fontSize: 12,
  letterSpacing: "0.04em",
  cursor: "pointer",
};