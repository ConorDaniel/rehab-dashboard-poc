import { useEffect, useState } from "react";

type Patient = {
  id: string;
  name: string;
  room: string;
  bed: string;
};

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

    fetch(`${baseUrl}/patients`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Patient[];
      })
      .then((data) => {
        setPatients(Array.isArray(data) ? data : []);
        setLastUpdated(new Date().toLocaleString());
        setError(null);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      );
  }, []);

  const statusText = error ? "API error" : patients.length ? "Live" : "Loading";
  const statusBg = error ? "#fff1f2" : patients.length ? "#ecfdf3" : "#fff7ed";

  return (
    <div style={{ fontFamily: "system-ui", background: "#f6f7f9", minHeight: "100vh" }}>
      
      {/* HEADER */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid #e6e8eb",
          padding: "18px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              Rehab Dashboard PoC
            </div>
            <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
              Rehab Hospital X • Ward 1
            </div>
          </div>

          <div
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid #e6e8eb",
              background: statusBg,
            }}
          >
            {statusText}
          </div>
        </div>
      </header>

      {/* BODY */}
      <main style={{ padding: 60 }}>
        {error && (
          <div
            style={{
              maxWidth: 600,
              margin: "0 auto 32px auto",
              background: "white",
              border: "1px solid #ffd5da",
              color: "#b42318",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!error && patients.length === 0 && (
          <div
            style={{
              maxWidth: 600,
              margin: "0 auto",
              background: "white",
              border: "1px solid #e6e8eb",
              borderRadius: 12,
              padding: 20,
              textAlign: "center",
              color: "#666",
            }}
          >
            Loading patient cards…
          </div>
        )}

        {/* CENTERED 2x2 GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 420px)",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {patients.map((p) => (
            <div
              key={p.id}
              style={{
                background: "white",
                border: "1px solid #e6e8eb",
                borderRadius: 18,
                padding: 28,
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                transition: "transform 180ms ease, box-shadow 180ms ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow =
                  "0 18px 36px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 2px 6px rgba(0,0,0,0.08)";
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {p.name}
              </div>

              <div style={{ marginTop: 18, fontSize: 16, color: "#555" }}>
                Room {p.room}
              </div>

              <div style={{ marginTop: 6, fontSize: 16, color: "#555" }}>
                {p.bed}
              </div>

              <div style={{ marginTop: 24, fontSize: 13, color: "#777" }}>
                Click to view trends (coming next).
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          padding: "18px 24px",
          borderTop: "1px solid #e6e8eb",
          background: "white",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#666",
          }}
        >
          <div>Rehab Dashboard PoC</div>
          <div>{lastUpdated ? `Last updated: ${lastUpdated}` : ""}</div>
        </div>
      </footer>
    </div>
  );
}