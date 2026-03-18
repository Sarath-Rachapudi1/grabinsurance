import { BrowserRouter, Routes, Route } from "react-router-dom";
import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import StorePage from "./pages/StorePage";
import MyPolicies from "./pages/MyPolicies";
import OperatorDashboard from "./components/OperatorDashboard";
import VisualizerPage from "./pages/VisualizerPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Visualizer is full-screen — no navbar/announcement bar */}
        <Route path="/visualizer" element={<VisualizerPage />} />

        {/* All other routes share the standard shell */}
        <Route path="*" element={
          <>
            <AnnouncementBar />
            <Navbar />
            <Routes>
              <Route path="/"                  element={<Home />} />
              <Route path="/stores"            element={<Home />} />
              <Route path="/stores/:storeId"   element={<StorePage />} />
              <Route path="/my-policies"       element={<MyPolicies />} />
              <Route path="/operator"          element={<OperatorDashboard />} />
            </Routes>
          </>
        } />
      </Routes>
    </BrowserRouter>
  );
}
