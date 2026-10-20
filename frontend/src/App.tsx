// src/App.tsx
import type { ReactNode } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./components/contexts/AuthContext";
import { ProtectedRoute } from "./components/route/ProtectedRoute";
import { PublicRoute } from "./components/route/PublicRoute";
import Layout from "./components/Layout/Layout";
import Toaster from "./components/ui/Toaster";

import LandingPage from "./pages/LandingPage";
import AuthScreen from "./pages/Auth/AuthPage";
import RegisterPage from "./pages/Auth/RegisterPage";
import OAuthCallback from "./pages/Auth/OAuthCallback";
import DashboardScreen from "./pages/Dashboard";
import EspacePage from "./pages/Espace/EspacePage";
import SpaceById from "./pages/Espace/[id]";
import CorbeillePage from "./pages/Corbeille/CorbeillePage";
import DatabasePage from "./pages/Database/DatabasePage";
import DatabaseSelectedPage from "./pages/Database/[id]";
import NotFoundPage from "./pages/NotFoundPage";

const publicPage = (page: ReactNode) => <PublicRoute>{page}</PublicRoute>;

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={publicPage(<LandingPage />)} />
          <Route path="/login" element={publicPage(<AuthScreen />)} />
          <Route path="/register" element={publicPage(<RegisterPage />)} />
          <Route path="/auth/callback" element={<OAuthCallback />} />

          {/* Routes protégées, dans la structure de l'application */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/espace" element={<EspacePage />} />
            <Route path="/espace/:id" element={<SpaceById />} />
            <Route path="/corbeille" element={<CorbeillePage />} />
            <Route path="/database" element={<DatabasePage />} />
            <Route path="/database/:id" element={<DatabaseSelectedPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
