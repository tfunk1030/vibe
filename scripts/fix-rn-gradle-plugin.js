#!/usr/bin/env node
/**
 * Script to fix the React Native Gradle plugin's Windows cmd/c issue
 * This script modifies TaskUtils.kt to remove the cmd /c wrapper on Windows
 */

const fs = require('fs');
const path = require('path');

const taskUtilsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'shared',
  'src',
  'main',
  'kotlin',
  'com',
  'facebook',
  'react',
  'utils',
  'TaskUtils.kt'
);

if (!fs.existsSync(taskUtilsPath)) {
  console.log('React Native Gradle plugin not found, skipping fix...');
  process.exit(0);
}

let content = fs.readFileSync(taskUtilsPath, 'utf8');

// Check if already fixed
if (content.includes('// Workaround: Don\'t wrap with cmd /c')) {
  console.log('React Native Gradle plugin already fixed.');
  process.exit(0);
}

// Apply the fix
const oldPattern = `fun windowsAwareCommandLine(args: List<Any>): List<Any> =
    if (Os.isWindows()) {
      listOf("cmd", "/c") + args
    } else {
      args
    }`;

const newPattern = `fun windowsAwareCommandLine(args: List<Any>): List<Any> =
    // Workaround: Don't wrap with cmd /c on Windows as it causes issues with Gradle's exec
    // Node.js commands work fine when executed directly by Gradle
    args`;

if (content.includes(oldPattern)) {
  content = content.replace(oldPattern, newPattern);
  fs.writeFileSync(taskUtilsPath, content, 'utf8');
  console.log('✅ Fixed React Native Gradle plugin Windows cmd/c issue');
} else {
  console.log('⚠️  Could not find the expected pattern in TaskUtils.kt');
  console.log('The file may have been updated. Please check manually.');
  process.exit(1);
}

