import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { AnimatorProvider } from "./contexts/AnimatorContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AppRoutes } from "./router/routes";
import { ErrorBoundary } from "./ui/ErrorBoundary/ErrorBoundary";
import "./App.css";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename="/doomjelly-studio">
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <ProjectProvider>
                <AnimatorProvider>
                  <AppRoutes />
                </AnimatorProvider>
              </ProjectProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
