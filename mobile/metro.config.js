// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for React Native dependency resolution issues
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require', 'default', 'import'],
  // Custom resolver to handle promise package subpath imports
  resolveRequest: (context, realModuleName, platform, moduleName) => {
    // Handle promise package subpath imports (legacy package without exports field)
    if (realModuleName && realModuleName.startsWith('promise/')) {
      try {
        // Try to resolve using require.resolve first
        const resolvedPath = require.resolve(realModuleName, {
          paths: [context.originModulePath || __dirname],
        });
        return {
          filePath: resolvedPath,
          type: 'sourceFile',
        };
      } catch (e) {
        // If that fails, try constructing the path directly
        try {
          const promisePath = path.join(__dirname, 'node_modules', realModuleName + '.js');
          if (require('fs').existsSync(promisePath)) {
            return {
              filePath: promisePath,
              type: 'sourceFile',
            };
          }
        } catch (e2) {
          // Fall through to default resolver
        }
      }
    }
    // Use default resolution for other modules
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, realModuleName, platform, moduleName);
    }
    // Fallback to context.resolveRequest if no default resolver
    return context.resolveRequest(context, realModuleName, platform, moduleName);
  },
};

// Block problematic nested package lookups
// Ensure blockList is an array
const existingBlockList = Array.isArray(config.resolver.blockList) 
  ? config.resolver.blockList 
  : config.resolver.blockList 
    ? [config.resolver.blockList] 
    : [];
    
config.resolver.blockList = [
  ...existingBlockList,
  /node_modules\/react-native\/node_modules\/.*/,
];

module.exports = config;

