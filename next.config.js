/** @type {import('next').NextConfig} */
const path = require('path')
const webpack = require('webpack')

const nextConfig = {
  webpack: (config) => {
    const isCypressComponentTest = process.env.CYPRESS_COMPONENT_TEST === 'true'

    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
      sharp$: false,
    }

    if (isCypressComponentTest) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /app\/actions\/logging(\.ts)?$/,
          path.resolve(__dirname, 'cypress/mocks/logging.ts')
        ),
        new webpack.NormalModuleReplacementPlugin(
          /^next\/navigation$/,
          path.resolve(__dirname, 'cypress/mocks/next-navigation.ts')
        )
      )
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /libheif-js/, message: /Critical dependency/ },
    ]
    return config
  },
}

module.exports = nextConfig
