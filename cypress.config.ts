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
      void on
      process.env.CYPRESS_COMPONENT_TEST = "true"
      return config
    },
  },
});