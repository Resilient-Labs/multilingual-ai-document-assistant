import { defineConfig } from "cypress";
import path from "path";

type CypressWebpackConfig = {
  resolve?: {
    alias?: Record<string, unknown>
  } & Record<string, unknown>
} & Record<string, unknown>

export default defineConfig({
  projectId: '51aa3d',
  allowCypressEnv: false,

  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
      webpackConfig: async (config: CypressWebpackConfig = {}) => {
        return {
          ...config,
          resolve: {
            ...(config.resolve ?? {}),
            alias: {
              ...(config.resolve?.alias ?? {}),
              'next/navigation': path.resolve(__dirname, 'cypress/mocks/next-navigation.ts'),
              '@/app/actions/logging': path.resolve(__dirname, 'cypress/mocks/logging.ts'),
            }
          }
        }
      },
    },
    setupNodeEvents(on, config) {
      // ... rest of your existing setupNodeEvents unchanged
      void on
      process.env.CYPRESS_COMPONENT_TEST = "true"
      const fs = require("node:fs")
      const nodePath = require("node:path")
      const targetPath = nodePath.join(config.projectRoot, "components/upload-form.tsx")
      fetch("http://127.0.0.1:7368/ingest/6cae3c54-0e69-499b-9572-025f7397e853", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e45ed" },
        body: JSON.stringify({
          sessionId: "8e45ed",
          runId: "pre-fix",
          hypothesisId: "A,B,C,D",
          location: "cypress.config.ts:12",
          message: "Cypress component resolver context",
          data: {
            cwd: process.cwd(),
            projectRoot: config.projectRoot,
            specPattern: config.component?.specPattern,
            importSpecifier: "components/upload-form.tsx",
            aliasConfiguredInTsconfig: "@/*",
            targetPath,
            targetExists: fs.existsSync(targetPath),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      fetch("http://127.0.0.1:7368/ingest/6cae3c54-0e69-499b-9572-025f7397e853", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8e45ed" },
        body: JSON.stringify({
          sessionId: "8e45ed",
          runId: "post-import-fix",
          hypothesisId: "E,F,G",
          location: "cypress.config.ts:39",
          message: "Cypress server-action dependency context",
          data: {
            cypressComponentTest: process.env.CYPRESS_COMPONENT_TEST,
            loggingActionPath: nodePath.join(config.projectRoot, "app/actions/logging.ts"),
            loggingActionExists: fs.existsSync(nodePath.join(config.projectRoot, "app/actions/logging.ts")),
            reactServerDomWebpackClientAvailable: (() => {
              try {
                require.resolve("react-server-dom-webpack/client")
                return true
              } catch {
                return false
              }
            })(),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      return config
    },
  },
});