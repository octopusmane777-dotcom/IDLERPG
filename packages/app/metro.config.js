const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all packages in the monorepo so Metro picks up changes in packages/core etc.
config.watchFolders = [monorepoRoot];

// Resolve node_modules from the monorepo root first, then the app's own node_modules.
// This is what lets packages/core resolve firebase/* from the root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
