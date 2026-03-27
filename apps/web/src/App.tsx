import { Routes, Route } from "react-router-dom";
import RagPrototypePage from "./pages/RagPrototypePage";
import "./App.css";
import WelcomePage from "./pages/WelcomePage";
import PatientListPage from "./pages/PatientListPage";
import PatientDashboardPage from "./pages/PatientDashboardPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/patients" element={<PatientListPage />} />
      <Route path="/patient/:id" element={<PatientDashboardPage />} />
      <Route path="/rag" element={<RagPrototypePage />} />
    </Routes>
  );
}