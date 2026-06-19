import { createRoot } from "react-dom/client";
import { AdminPage } from "./pages/AdminPage";
import { MobilePage } from "./pages/MobilePage";
import "./styles.css";

function App() {
  if (window.location.pathname.startsWith("/admin")) return <AdminPage />;
  return <MobilePage />;
}

createRoot(document.getElementById("root")!).render(<App />);
