import { useEffect, useState } from "react";

type Patient = { id: string; name: string; room: string; bed: string };

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

    fetch(`${baseUrl}/patients`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Patient[];
      })
      .then(setPatients)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Rehab Dashboard PoC</h1>

      <h2>Patients</h2>
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!error && patients.length === 0 && <p>Loading…</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {patients.map((p) => (
          <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{p.name}</div>
            <div>Room: {p.room}</div>
            <div>Bed: {p.bed}</div>
          </div>
        ))}
      </div>
    </div>
  );
}