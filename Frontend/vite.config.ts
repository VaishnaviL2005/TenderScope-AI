import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// LOCAL DEVELOPMENT ONLY:
// The dev server (and `vite preview`) forward /api/v1/* to the FastAPI backend, so the
// browser only talks to http://localhost:5173 and CORS is not involved.
// A production build has no proxy; see README "Connecting to a deployed backend".
export default defineConfig(({ mode }) => {
  // Empty prefix: lets the config read DEV_PROXY_TARGET. Only VITE_* reaches the browser.
  const env = loadEnv(mode, ".", "");
  const target = (env.DEV_PROXY_TARGET || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
  const proxy = {
    "/api/v1": { target, changeOrigin: true },
  };
  return {
    plugins: [react()],
    server: { host: "localhost", port: 5173, strictPort: true, proxy },
    preview: { host: "localhost", port: 5173, strictPort: true, proxy },
  };
});
