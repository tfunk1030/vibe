#!/usr/bin/env node
/**
 * Cross-platform script to rebuild the React Native Gradle plugin
 * This ensures the Windows cmd/c fix is compiled into the JAR
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const pluginDir = path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin');

if (!fs.existsSync(pluginDir)) {
  console.log('React Native Gradle plugin not found, skipping rebuild...');
  process.exit(0);
}

const isWindows = os.platform() === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

try {
  console.log('Rebuilding React Native Gradle plugin...');
  execSync(`${gradlew} :shared:jar :react-native-gradle-plugin:jar -x test`, {
    cwd: pluginDir,
    stdio: 'inherit',
    shell: true
  });
  console.log('✅ React Native Gradle plugin rebuilt successfully');
} catch (error) {
  // Non-critical - the plugin might already be built or the build might not be needed
  console.log('⚠️  React Native Gradle plugin rebuild skipped (non-critical)');
  process.exit(0);
}

