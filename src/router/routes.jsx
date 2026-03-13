import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "../layout/AppShell";
import { LoginPage } from "../features/auth/LoginPage";

const AnimatorPage = lazy(() =>
  import("../features/animator").then((m) => ({ default: m.AnimatorPage })),
);
const JellySpriteWorkspace = lazy(() =>
  import("../features/jelly-sprite").then((m) => ({
    default: m.JellySpriteWorkspace,
  })),
);
const ProjectsPage = lazy(() =>
  import("../features/projects").then((m) => ({ default: m.ProjectsPage })),
);
const SettingsPage = lazy(() =>
  import("../features/settings").then((m) => ({ default: m.SettingsPage })),
);

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="page-loading" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="animator" element={<AnimatorPage />} />
          <Route path="animator/:spriteId" element={<AnimatorPage />} />
          <Route path="jelly-sprite" element={<JellySpriteWorkspace />} />
          <Route
            path="jelly-sprite/:spriteId"
            element={<JellySpriteWorkspace />}
          />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
