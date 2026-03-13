import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { DocumentProvider } from "./contexts/DocumentContext";
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
              <DocumentProvider>
                <AnimatorProvider>
                  <AppRoutes />
                </AnimatorProvider>
              </DocumentProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
