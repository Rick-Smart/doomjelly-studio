import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// TEMP: auth bypass for production testing — revert when real auth is wired up
const AUTH_BYPASS = true;

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (AUTH_BYPASS) return children;
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
