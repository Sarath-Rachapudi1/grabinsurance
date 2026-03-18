import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Stable session ID — persists for the browser tab lifetime
if (!sessionStorage.getItem("grabon_session_id")) {
  sessionStorage.setItem("grabon_session_id", crypto.randomUUID());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
