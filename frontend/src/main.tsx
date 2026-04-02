import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import CompanyDetail from "./CompanyDetail";
import { ErrorBoundary } from "./ErrorBoundary";
import { WatchlistProvider } from "./WatchlistContext";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <WatchlistProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/company/:symbol" element={<CompanyDetail />} />
            </Routes>
          </BrowserRouter>
        </WatchlistProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
