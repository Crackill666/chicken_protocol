import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(() => {
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const githubPagesBase = repoName ? `/${repoName}/` : "/";

  return {
    base: process.env.GITHUB_ACTIONS === "true" ? githubPagesBase : "/",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: true,
    },
  };
});
