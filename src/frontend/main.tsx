import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { AgeVerificationProvider } from "./AgeVerificationContext";
import { ThemeProvider } from "./ThemeContext";
import Root from "./Root";
import ToastProvider from "./ToastProvider";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AgeVerificationProvider>
          <ThemeProvider>
            <Root />
            <ToastProvider />
          </ThemeProvider>
        </AgeVerificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
