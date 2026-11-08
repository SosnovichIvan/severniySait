import { defineConfig } from "cypress";
export default defineConfig({
  e2e: { baseUrl: "http://127.0.0.1:5180", supportFile: false },
  video: false,
  screenshotOnRunFailure: true,
  viewportWidth: 1440,
  viewportHeight: 1000,
});
