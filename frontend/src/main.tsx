import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import App from "./App";
import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import "./styles.css";
import "./theme-cin.css";
import { markAutomation } from "./fx/motion";
import { applyInitialTheme } from "./components/ThemeToggle";

applyInitialTheme();
markAutomation();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
