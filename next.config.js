const fs = require("fs");
const path = require("path");

// #region agent log
fetch("http://127.0.0.1:7852/ingest/46e95e38-77cb-48d1-8368-8f1e58e7aa91", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Debug-Session-Id": "bec7d8",
  },
  body: JSON.stringify({
    sessionId: "bec7d8",
    runId: "pre-fix",
    hypothesisId: "H1-H2-H4",
    location: "next.config.js:1",
    message: "Build config loaded with type declaration probes",
    data: {
      hasLocalWordExtractorTypes: fs.existsSync(
        path.join(process.cwd(), "types", "word-extractor.d.ts")
      ),
      hasPackageTypesInNodeModules: fs.existsSync(
        path.join(process.cwd(), "node_modules", "word-extractor", "index.d.ts")
      ),
      hasDefinitelyTypedPackage: fs.existsSync(
        path.join(process.cwd(), "node_modules", "@types", "word-extractor")
      ),
    },
    timestamp: Date.now(),
  }),
}).catch(() => { });
// #endregion

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": false,
      "sharp$": false,
    };
    return config;
  },
};

module.exports = nextConfig;
