import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import UploadTender from "./pages/UploadTender";
import TenderHistory from "./pages/TenderHistory";
import ReportsIndex from "./pages/ReportsIndex";
import TenderReport from "./pages/TenderReport";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="upload" element={<UploadTender />} />
        <Route path="history" element={<TenderHistory />} />
        <Route path="reports" element={<ReportsIndex />} />
        <Route path="reports/:tenderId" element={<TenderReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
