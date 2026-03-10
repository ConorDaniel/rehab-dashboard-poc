import { Routes, Route } from "react-router-dom";
import "./App.css";
import PatientListPage from "./pages/PatientListPage";
import PatientDashboardPage from "./pages/PatientDashboardPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PatientListPage />} />
      <Route path="/patient/:id" element={<PatientDashboardPage />} />
    </Routes>
  );
}