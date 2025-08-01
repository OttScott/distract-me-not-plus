#!/usr/bin/env node

/**
 * Local Security Testing Script
 * Runs the same security checks as CI to catch issues early
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 Starting Local Security Tests...\n');

/**
 * Check if a command exists
 * Uses safe, hardcoded command strings - not user input
 */
function commandExists(command) {
  // Validate command input to prevent injection
  if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
    return false;
  }
  
  try {
    // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    try {
      // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
      execSync(`where ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Install Semgrep if not available
 */
async function ensureSemgrep() {
  if (commandExists('semgrep')) {
    console.log('✅ Semgrep is already installed');
    return true;
  }

  console.log('⚠️  Semgrep not found. Attempting to install...');
  
  try {
    // Try pip installation
    if (commandExists('pip')) {
      console.log('📦 Installing Semgrep via pip...');
      // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
      execSync('pip install semgrep', { stdio: 'inherit' });
      return true;
    }
    
    // Try pip3 installation
    if (commandExists('pip3')) {
      console.log('📦 Installing Semgrep via pip3...');
      // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
      execSync('pip3 install semgrep', { stdio: 'inherit' });
      return true;
    }
    
    // Try Python module installation
    if (commandExists('python')) {
      console.log('📦 Installing Semgrep via python -m pip...');
      // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
      execSync('python -m pip install semgrep', { stdio: 'inherit' });
      return true;
    }
    
    if (commandExists('python3')) {
      console.log('📦 Installing Semgrep via python3 -m pip...');
      // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
      execSync('python3 -m pip install semgrep', { stdio: 'inherit' });
      return true;
    }

    console.log('❌ Could not install Semgrep. Please install Python and pip manually.');
    console.log('   Visit: https://semgrep.dev/docs/getting-started/');
    return false;
  } catch (error) {
    console.log('❌ Failed to install Semgrep:', error.message);
    return false;
  }
}

/**
 * Run Semgrep scan
 */
async function runSemgrep() {
  try {
    console.log('🔍 Running Semgrep security scan...');
    
    // Run the same scan as CI but with more verbose output for local development
    // This is a hardcoded command string, not user input - safe from injection
    const semgrepCmd = 'semgrep --config=auto --config=.semgrep.yml --severity=ERROR --json --quiet';
    
    // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
    const result = execSync(semgrepCmd, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Parse results
    const findings = JSON.parse(result);
    
    if (findings.results && findings.results.length > 0) {
      console.log(`⚠️  Found ${findings.results.length} security issue(s):\n`);
      
      findings.results.forEach((finding, index) => {
        console.log(`${index + 1}. ${finding.check_id}`);
        console.log(`   File: ${finding.path}:${finding.start.line}`);
        console.log(`   Severity: ${finding.extra.severity}`);
        console.log(`   Message: ${finding.extra.message}`);
        if (finding.extra.fix) {
          console.log(`   Fix: ${finding.extra.fix}`);
        }
        console.log('');
      });
      
      return false; // Found issues
    } else {
      console.log('✅ No security issues found!');
      return true; // No issues
    }
    
  } catch (error) {
    const stderr = error.stderr ? error.stderr.toString() : '';
    const stdout = error.stdout ? error.stdout.toString() : '';
    
    // Check if this is a "findings found" error (exit code 1)
    if (error.status === 1 && stdout) {
      try {
        const findings = JSON.parse(stdout);
        if (findings.results && findings.results.length > 0) {
          console.log(`❌ Found ${findings.results.length} blocking security issue(s):\n`);
          
          findings.results.forEach((finding, index) => {
            console.log(`${index + 1}. ${finding.check_id}`);
            console.log(`   File: ${finding.path}:${finding.start.line}`);
            console.log(`   Severity: ${finding.extra.severity}`);
            console.log(`   Message: ${finding.extra.message}`);
            if (finding.extra.fix) {
              console.log(`   Suggested fix: ${finding.extra.fix}`);
            }
            console.log('');
          });
          
          return false;
        }
      } catch (parseError) {
        // If we can't parse, fall through to general error handling
      }
    }
    
    console.log('❌ Semgrep scan failed:');
    if (stderr) console.log('Error:', stderr);
    if (stdout) console.log('Output:', stdout);
    return false;
  }
}

/**
 * Run npm audit
 */
function runNpmAudit() {
  try {
    console.log('🔍 Running npm audit...');
    // Hardcoded npm audit command - safe from injection
    // semgrep:ignore javascript.lang.security.detect-child-process.detect-child-process
    execSync('npm audit --audit-level=moderate --production', { stdio: 'inherit' });
    console.log('✅ No security vulnerabilities found in dependencies');
    return true;
  } catch (error) {
    console.log('⚠️  npm audit found security issues (see output above)');
    return false;
  }
}

/**
 * Check for secrets
 */
function checkForSecrets() {
  console.log('🔍 Checking for common secrets patterns...');
  
  const secretPatterns = [
    /(password|pwd|pass)\s*[:=]\s*['"][^'"]{8,}/i,
    /(api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{16,}/i,
    /(secret|token)\s*[:=]\s*['"][^'"]{16,}/i,
    /(private[_-]?key)\s*[:=]/i,
  ];
  
  const sourceFiles = [];
  
  function findSourceFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !['node_modules', 'build', '.git', 'coverage'].includes(file)) {
        findSourceFiles(filePath);
      } else if (file.match(/\.(js|jsx|ts|tsx|json|env)$/)) {
        sourceFiles.push(filePath);
      }
    }
  }
  
  findSourceFiles('.');
  
  let foundSecrets = false;
  
  for (const filePath of sourceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        for (const pattern of secretPatterns) {
          if (pattern.test(line)) {
            console.log(`⚠️  Potential secret found:`);
            console.log(`   File: ${filePath}:${index + 1}`);
            console.log(`   Line: ${line.trim()}`);
            foundSecrets = true;
          }
        }
      });
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  if (!foundSecrets) {
    console.log('✅ No obvious secrets found in source code');
  }
  
  return !foundSecrets;
}

/**
 * Main function
 */
async function main() {
  let allPassed = true;
  
  // 1. Ensure Semgrep is available
  const semgrepAvailable = await ensureSemgrep();
  
  // 2. Run Semgrep if available
  if (semgrepAvailable) {
    const semgrepPassed = await runSemgrep();
    allPassed = allPassed && semgrepPassed;
  } else {
    console.log('⚠️  Skipping Semgrep scan (not available)');
    allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 3. Run npm audit
  const auditPassed = runNpmAudit();
  allPassed = allPassed && auditPassed;
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // 4. Check for secrets
  const secretsPassed = checkForSecrets();
  allPassed = allPassed && secretsPassed;
  
  console.log('\n' + '='.repeat(50));
  console.log('🔒 Security Test Summary');
  console.log('='.repeat(50));
  
  if (allPassed) {
    console.log('✅ All security tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some security tests failed. Please address the issues above.');
    console.log('\nTo fix Semgrep issues:');
    console.log('1. Review the flagged code for security vulnerabilities');
    console.log('2. Apply suggested fixes or add ignore comments if safe');
    console.log('3. Re-run this script to verify fixes');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Security testing failed:', error);
    process.exit(1);
  });
}

module.exports = { main };
