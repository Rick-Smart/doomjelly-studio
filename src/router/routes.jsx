import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "../features/layout/AppShell";
import { HomePage } from "../features/home/HomePage";
import { EditorPage } from "../features/editor/EditorPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SettingsPage } from "../features/settings/SettingsPage";

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
        <Route index element={<HomePage />} />
        <Route path="editor" element={<EditorPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
