import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Sample = {
  samples: { gmag: number }[];
  durationMs: number;
};

function MovementCard({ title, file }: { title: string; file: string }) {
  const [data, setData] = useState<Sample | null>(null);

  useEffect(() => {
    fetch(`/${file}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, [file]);

  if (!data) {
    return <div className="dashboard-panel">Loading {title}...</div>;
  }

  const gmags = data.samples?.map((s) => s.gmag) || [];

  if (gmags.length === 0) {
    return <div className="dashboard-panel">No data for {title}</div>;
  }

  const peak = Math.max(...gmags);
  const avg = Math.round(gmags.reduce((a, b) => a + b, 0) / gmags.length);

  const isFall = title.toLowerCase().includes("fall");

  return (
    <div
      className="dashboard-panel"
      style={{
        background: isFall ? "#fee2e2" : "#ffffff",
        border: isFall ? "2px solid #dc2626" : undefined,
      }}
    >
      <h2 className="dashboard-panel__title">{title}</h2>

      <div style={{ marginBottom: 8 }}>
        <strong>Peak:</strong> {peak}
        <span style={{ fontSize: 12, color: "#666" }}>
          {" "} (maximum movement detected)
        </span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Average:</strong> {avg}
        <span style={{ fontSize: 12, color: "#666" }}>
          {" "} (overall movement intensity)
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Duration:</strong> {Math.round(data.durationMs / 1000)} sec
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, color: "#555" }}>
        {peak > 1000
          ? "Extreme impact pattern — consistent with a fall-like event"
          : avg > 30
          ? "Sustained effort movement — likely a transfer activity"
          : "Short, controlled movement — typical of repositioning or transitions"}
      </div>

      <div style={{ display: "flex", gap: 2, height: 40, alignItems: "flex-end" }}>
        {gmags.slice(0, 60).map((g, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: `${Math.min((g / peak) * 100, 100)}%`,
              background: "#3b82f6",
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        Movement over time (left → right)
      </div>
    </div>
  );
}

export default function RagPrototypePage() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div>
            <div className="app-title">RAG Prototype</div>
            <div className="app-subtitle">
              Movement Pattern Comparison (Patient 1)
            </div>
          </div>

          <button
            className="patient-card__button"
            onClick={() => navigate("/patients")}
          >
            Back
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="dashboard-layout">
          <div className="dashboard-panel">
            <h2 className="dashboard-panel__title">How to interpret this view</h2>

            <p style={{ marginBottom: 10 }}>
              Each card represents a real movement recorded from a wearable sensor.
              The system measures movement using <strong>g-force magnitude (gmag)</strong>,
              which reflects how much the body is accelerating.
            </p>

            <ul style={{ paddingLeft: 20, marginBottom: 10 }}>
              <li><strong>Peak:</strong> the highest movement detected</li>
              <li><strong>Average:</strong> the overall intensity of movement</li>
              <li><strong>Duration:</strong> how long the movement lasted</li>
            </ul>

            <p>
              The blue bars show movement over time. Taller bars indicate more intense
              movement. Different activities produce different patterns, which could
              support future retrieval-based movement interpretation.
            </p>
          </div>

          <div className="dashboard-panel">
            <h2 className="dashboard-panel__title">Summary of movement types</h2>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Movement
                    </th>
                    <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Peak
                    </th>
                    <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Average
                    </th>
                    <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Pattern
                    </th>
                    <th style={{ textAlign: "left", padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Interpretation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Sitting → Standing
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Moderate
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Moderate
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Short, sharp transition
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Controlled transfer activity
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Rolling in Bed
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Lower
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Lower
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Longer, diffuse, multi-directional
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Bed mobility / repositioning
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Lying → Sitting
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Moderate to high
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Higher
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Sustained effort with multiple peaks
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>
                      Bed exit / effortful transfer
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: "10px" }}>
                      Fall (Simulated)
                    </td>
                    <td style={{ padding: "10px" }}>
                      Extreme
                    </td>
                    <td style={{ padding: "10px" }}>
                      Very high
                    </td>
                    <td style={{ padding: "10px" }}>
                      Violent impact spike followed by rest
                    </td>
                    <td style={{ padding: "10px" }}>
                      Fall-like event
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <MovementCard
            title="Sitting → Standing"
            file="p1_sitting_to_standing.json"
          />

          <MovementCard
            title="Rolling in Bed"
            file="p1_in_bed_01.json"
          />

          <MovementCard
            title="Lying → Sitting"
            file="p1_lying_sitting.json"
          />

          <MovementCard
            title="Fall (Simulated)"
            file="p1_falling_standing.json"
          />
        </div>
      </main>
    </div>
  );
}