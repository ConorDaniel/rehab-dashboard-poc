import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";

export default function WelcomePage() {
  const navigate = useNavigate();

  function handleEnter() {
    navigate("/patients");
  }

  return (
    <AppLayout
      title="Rehab Dashboard PoC"
      subtitle="Welcome"
      statusText="Demo Mode"
      statusClass="app-status app-status--live"
      footerLeft="Rehab Dashboard PoC"
      footerRight="Welcome screen"
    >
      <div className="welcome-page">
        <div className="welcome-overlay" />

        <div className="welcome-card">
          <h1 className="welcome-title">
            <span>Welcome to the</span>
            <span>Rehab Dashboard Proof of Concept</span>
          </h1>

          <p className="welcome-subtitle">
            Please confirm location and proceed to the dashboard.
          </p>

          <div className="welcome-form">
            <div className="welcome-field">
              <label htmlFor="hospital">Hospital</label>
              <select id="hospital" defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                <option value="Hospital X">Hospital X</option>
              </select>
            </div>

            <div className="welcome-field">
              <label htmlFor="ward">Ward</label>
              <select id="ward" defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                <option value="Ward 1">Ward 1</option>
              </select>
            </div>

            <div className="welcome-field">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" value="Clinician 1" readOnly />
            </div>

            <div className="welcome-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value="xxxxxxxxxxx" readOnly />
            </div>

            <button
              type="button"
              className="welcome-button"
              onClick={handleEnter}
            >
              Click to Enter
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}