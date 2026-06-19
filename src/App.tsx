import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import OverlayGallery from "./windows/OverlayGallery";
import RebuildLabWindow from "./windows/RebuildLabWindow";
import SettingsWindow from "./windows/SettingsWindow";

// Lazy so the legacy overlay shell CSS + Tauri-only overlay logic never load on
// the gallery/settings routes. Keeps the gallery free of overlay-window leaks.
const OverlayWindow = lazy(() => import("./windows/OverlayWindow"));

export default function App() {
  return (
    <Routes>
      <Route path="/overlay" element={<Suspense fallback={null}><OverlayWindow /></Suspense>} />
      <Route path="/overlay-gallery" element={<OverlayGallery />} />
      <Route path="/rebuild-lab" element={<RebuildLabWindow />} />
      <Route path="/settings" element={<SettingsWindow />} />
      <Route path="*" element={<Navigate to="/overlay" replace />} />
    </Routes>
  );
}
