import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "../layout/AppShell";
import { AnimatorPage } from "../features/animator/AnimatorPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { JellySpriteWorkspace } from "../features/jelly-sprite/JellySpriteWorkspace";

export function AppRoutes() {
  return (
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
  );
}
