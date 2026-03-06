import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AppRoutes } from "./router/routes";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter basename="/doomjelly-studio">
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <ProjectProvider>
              <AppRoutes />
            </ProjectProvider>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
