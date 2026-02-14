import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "5oiwpi",

  component: {
    excludeSpecPattern: "public/",
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
    defaultCommandTimeout: 40000,
  },

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
