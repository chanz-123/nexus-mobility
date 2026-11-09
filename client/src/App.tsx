import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/auth.context";
import { SocketProvider } from "./context/socket.context";
import { Navbar } from "./components/Navbar";
import { CustomerPage } from "./pages/CustomerPage";
import { DriverPage } from "./pages/DriverPage";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { SimulationPage } from "./pages/SimulationPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BrandLogo } from "./components/BrandLogo";
import { Loader2 } from "lucide-react";

const AppContent: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4 select-none">
        <div className="flex flex-col items-center gap-5">
          <div className="p-4 bg-white rounded-3xl shadow-xl border border-gray-100 animate-pulse">
            <BrandLogo theme="nexus" size="lg" />
          </div>
          <div className="flex items-center gap-2 text-emerald-700 font-black text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Đang khởi động Nexus Mobility...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-50 flex flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 w-full overflow-hidden">
        <Routes>
          <Route path="/" element={<CustomerPage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
