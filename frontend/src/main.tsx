import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { SharedListView } from "./components/SharedListView.js";
import "./index.css";

const sharedMatch = window.location.pathname.match(
  /^\/shared\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
);
const sharedToken = sharedMatch ? sharedMatch[1] : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {sharedToken ? <SharedListView token={sharedToken} /> : <App />}
  </StrictMode>
);
