#!/usr/bin/env node

/**
 * Dependency Upgrade Manager
 * Provides utilities for systematic dependency upgrades
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PHASE_CONFIG = {
  'security-critical': {
    description: 'Critical security vulnerabilities',
    dependencies: [
      'shell-quote',
      'immer', 
      'pbkdf2',
      'browserslist',
      'cookie',
      'cross-spawn',
      'path-to-regexp',
      'send',
      'serve-static',
      'loader-utils',
      'minimatch'
    ]
  },
  'build-system': {
    description: 'Build tools and configuration',
    dependencies: [
      'react-scripts',
      '@craco/craco',
      '@babel/core',
      '@babel/runtime',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-private-property-in-object',
      '@babel/plugin-transform-runtime',
      '@babel/preset-env',
      '@babel/preset-react',
      'copy-webpack-plugin'
    ]
  },
  'testing': {
    description: 'Testing framework and tools',
    dependencies: [
      '@testing-library/jest-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      '@types/jest',
      'jest-sonar-reporter'
    ]
  },
  'dev-tools': {
    description: 'Development and release tools',
    dependencies: [
      'nodemon',
      'prettier',
      'web-ext',
      'release-it',
      'sign-addon',
      'webpack-bundle-analyzer',
      'serve'
    ]
  },
  'ui-libraries': {
    description: 'UI and application dependencies',
    dependencies: [
      'evergreen-ui',
      'react',
      'react-dom',
      'react-router-dom',
      'date-fns',
      'query-string',
      'sass',
      'web-vitals'
    ]
  }
};

class DependencyUpgradeManager {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    this.lockFilePath = path.join(process.cwd(), 'package-lock.json');
  }

  // Get current vulnerabilities
  getCurrentVulnerabilities() {
    try {
      // nosemgrep: javascript.lang.security.audit.dangerous-child-process.dangerous-child-process
      // Safe: Hardcoded npm audit command with no user input
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      return {
        total: audit.metadata.vulnerabilities.total,
        critical: audit.metadata.vulnerabilities.critical,
        high: audit.metadata.vulnerabilities.high,
        moderate: audit.metadata.vulnerabilities.moderate,
        low: audit.metadata.vulnerabilities.low
      };
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities exist
      if (error.stdout) {
        const audit = JSON.parse(error.stdout);
        return {
          total: audit.metadata.vulnerabilities.total,
          critical: audit.metadata.vulnerabilities.critical,
          high: audit.metadata.vulnerabilities.high,
          moderate: audit.metadata.vulnerabilities.moderate,
          low: audit.metadata.vulnerabilities.low
        };
      }
      return null;
    }
  }

  // Create backup of current state
  createBackup(phase) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'upgrade-backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const backupFile = path.join(backupDir, `${phase}-${timestamp}.json`);
    const backupData = {
      phase,
      timestamp,
      packageJson: this.packageJson,
      vulnerabilities: this.getCurrentVulnerabilities()
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    // Also backup lock file
    if (fs.existsSync(this.lockFilePath)) {
      const lockBackupFile = path.join(backupDir, `${phase}-${timestamp}-package-lock.json`);
      fs.copyFileSync(this.lockFilePath, lockBackupFile);
    }
    
    console.log(`✅ Backup created: ${backupFile}`);
    return backupFile;
  }

  // Restore from backup
  restoreBackup(backupFile) {
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Restore package.json
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(backupData.packageJson, null, 2));
    
    // Restore package-lock.json if exists
    const backupDir = path.dirname(backupFile);
    const timestamp = path.basename(backupFile).split('-').slice(-1)[0].replace('.json', '');
    const lockBackupFile = path.join(backupDir, `${backupData.phase}-${timestamp}-package-lock.json`);
    
    if (fs.existsSync(lockBackupFile)) {
      fs.copyFileSync(lockBackupFile, this.lockFilePath);
    }
    
    console.log(`✅ Restored from backup: ${backupFile}`);
    
    // Reinstall dependencies
    // nosemgrep: javascript.lang.security.audit.dangerous-child-process.dangerous-child-process
    // Safe: Hardcoded npm ci command with no user input
    execSync('npm ci', { stdio: 'inherit' });
  }

  // Upgrade specific phase
  upgradePhase(phaseName, options = {}) {
    const phase = PHASE_CONFIG[phaseName];
    if (!phase) {
      throw new Error(`Unknown phase: ${phaseName}`);
    }

    console.log(`🚀 Starting upgrade phase: ${phase.description}`);
    
    const backupFile = this.createBackup(phaseName);
    
    try {
      // Get current vulnerabilities
      const beforeVulns = this.getCurrentVulnerabilities();
      console.log(`📊 Current vulnerabilities: ${beforeVulns?.total || 'unknown'}`);
      
      // Upgrade dependencies in this phase
      const depsToUpgrade = phase.dependencies.filter(dep => 
        this.packageJson.dependencies[dep] || this.packageJson.devDependencies[dep]
      );
      
      if (depsToUpgrade.length === 0) {
        console.log('ℹ️  No dependencies to upgrade in this phase');
        return;
      }
      
      console.log(`📦 Upgrading dependencies: ${depsToUpgrade.join(', ')}`);
      
      if (options.dryRun) {
        console.log('🔍 DRY RUN - would upgrade:');
        depsToUpgrade.forEach(dep => {
          console.log(`  - ${dep}`);
        });
        return;
      }
      
      // Use npm-check-updates to upgrade specific packages
      // Validate package names to prevent command injection
      const validPackageNames = depsToUpgrade.filter(dep => 
        typeof dep === 'string' && /^[@a-zA-Z0-9/_-]+$/.test(dep)
      );
      
      if (validPackageNames.length !== depsToUpgrade.length) {
        throw new Error('Invalid package names detected');
      }
      
      const updateCmd = `npx npm-check-updates -u ${validPackageNames.map(d => `--filter "${d}"`).join(' ')}`;
      // nosemgrep: javascript.lang.security.audit.dangerous-child-process.dangerous-child-process
      // Safe: Package names are validated with regex, command is constructed safely
      execSync(updateCmd, { stdio: 'inherit' });
      
      // Install updated dependencies
      console.log('📥 Installing updated dependencies...');
      // nosemgrep: javascript.lang.security.audit.dangerous-child-process.dangerous-child-process
      // Safe: Hardcoded npm install command with no user input
      execSync('npm install', { stdio: 'inherit' });
      
      // Run tests
      if (options.test !== false) {
        console.log('🧪 Running tests...');
        try {
          // nosemgrep: javascript.lang.security.audit.dangerous-child-process.dangerous-child-process
          // Safe: Hardcoded npm test command with no user input
          execSync('npm run test:ci', { stdio: 'inherit' });
          console.log('✅ Tests passed');
        } catch (error) {
          console.error('❌ Tests failed');
          if (options.rollbackOnFailure !== false) {
            console.log('🔄 Rolling back...');
            this.restoreBackup(backupFile);
            throw new Error('Tests failed, rolled back');
          }
        }
      }
      
      // Check vulnerabilities after upgrade
      const afterVulns = this.getCurrentVulnerabilities();
      console.log(`📊 Vulnerabilities after upgrade: ${afterVulns?.total || 'unknown'}`);
      
      if (beforeVulns && afterVulns) {
        const improvement = beforeVulns.total - afterVulns.total;
        console.log(`📈 Vulnerability improvement: ${improvement > 0 ? '-' : '+'}${Math.abs(improvement)}`);
      }
      
      console.log(`✅ Phase '${phaseName}' completed successfully`);
      
    } catch (error) {
      console.error(`❌ Phase '${phaseName}' failed:`, error.message);
      if (options.rollbackOnFailure !== false) {
        console.log('🔄 Rolling back...');
        this.restoreBackup(backupFile);
      }
      throw error;
    }
  }

  // List available phases
  listPhases() {
    console.log('📋 Available upgrade phases:');
    Object.entries(PHASE_CONFIG).forEach(([name, config]) => {
      console.log(`  ${name}: ${config.description}`);
      console.log(`    Dependencies: ${config.dependencies.join(', ')}`);
      console.log('');
    });
  }

  // Check current status
  checkStatus() {
    const vulns = this.getCurrentVulnerabilities();
    if (vulns) {
      console.log('🔍 Current Security Status:');
      console.log(`  Total vulnerabilities: ${vulns.total}`);
      console.log(`  Critical: ${vulns.critical}`);
      console.log(`  High: ${vulns.high}`);
      console.log(`  Moderate: ${vulns.moderate}`);
      console.log(`  Low: ${vulns.low}`);
    } else {
      console.log('✅ No vulnerabilities detected');
    }
    
    console.log('\\n📦 Package Information:');
    console.log(`  Total dependencies: ${Object.keys(this.packageJson.dependencies || {}).length}`);
    console.log(`  Total devDependencies: ${Object.keys(this.packageJson.devDependencies || {}).length}`);
  }
}

// CLI interface
if (require.main === module) {
  const manager = new DependencyUpgradeManager();
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  switch (command) {
    case 'status':
      manager.checkStatus();
      break;
    
    case 'list':
      manager.listPhases();
      break;
    
    case 'upgrade':
      const phase = args[0];
      const options = {
        dryRun: args.includes('--dry-run'),
        test: !args.includes('--no-test'),
        rollbackOnFailure: !args.includes('--no-rollback')
      };
      manager.upgradePhase(phase, options);
      break;
    
    case 'backup':
      const backupPhase = args[0] || 'manual';
      manager.createBackup(backupPhase);
      break;
    
    case 'restore':
      const backupFile = args[0];
      if (!backupFile) {
        console.error('Usage: node upgrade-manager.js restore <backup-file>');
        process.exit(1);
      }
      manager.restoreBackup(backupFile);
      break;
    
    default:
      console.log('Usage:');
      console.log('  node upgrade-manager.js status');
      console.log('  node upgrade-manager.js list');
      console.log('  node upgrade-manager.js upgrade <phase> [--dry-run] [--no-test] [--no-rollback]');
      console.log('  node upgrade-manager.js backup [phase-name]');
      console.log('  node upgrade-manager.js restore <backup-file>');
      console.log('');
      console.log('Available phases:');
      Object.keys(PHASE_CONFIG).forEach(phase => {
        console.log(`  - ${phase}`);
      });
  }
}

module.exports = DependencyUpgradeManager;
