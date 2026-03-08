import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { SharedListView } from "./components/SharedListView.js";
import { AdminDashboard } from "./components/AdminDashboard.js";
import "./index.css";

const pathname = window.location.pathname;

const sharedMatch = pathname.match(
  /^\/shared\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
);
const sharedToken = sharedMatch ? sharedMatch[1] : null;
const isAdmin = pathname === "/admin";

function Root() {
  if (isAdmin) return <AdminDashboard />;
  if (sharedToken) return <SharedListView token={sharedToken} />;
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
