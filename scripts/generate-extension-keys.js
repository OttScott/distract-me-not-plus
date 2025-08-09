#!/usr/bin/env node

/**
 * Extension Key Generation Utility
 * Generates new extension keys and IDs for rebranding
 * 
 * Clean Code Principles Applied:
 * - Single Responsibility: Only handles key generation
 * - Clear naming and documentation
 * - Proper error handling
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ExtensionKeyGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.manifestPath = path.join(this.projectRoot, 'public', 'manifest.json');
    this.firefoxManifestPath = path.join(this.projectRoot, 'public', 'manifest.firefox.json');
    this.buildManifestPath = path.join(this.projectRoot, 'build', 'manifest.json');
  }

  /**
   * Generate a new Chrome extension key
   * @returns {string} Base64 encoded public key
   */
  generateChromeKey() {
    console.log('🔑 Generating new Chrome extension key...');
    
    // Generate RSA key pair for Chrome extension
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const base64Key = Buffer.from(publicKey).toString('base64');
    
    // Save private key for future use (keep secure!)
    const keyDir = path.join(this.projectRoot, 'private-keys');
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(keyDir, 'chrome-extension-private.pem'), 
      privateKey,
      { mode: 0o600 } // Read/write for owner only
    );
    
    fs.writeFileSync(
      path.join(keyDir, 'chrome-extension-public-key.txt'), 
      base64Key
    );

    console.log('✅ Chrome key generated and saved to private-keys/');
    console.log('⚠️  IMPORTANT: Keep private-keys/ folder secure and never commit it!');
    
    return base64Key;
  }

  /**
   * Generate a new Firefox extension ID
   * @returns {string} Firefox extension ID in the format {uuid@domain}
   */
  generateFirefoxId() {
    console.log('🦊 Generating new Firefox extension ID...');
    
    // Generate UUID v4 for Firefox
    const uuid = crypto.randomUUID();
    const firefoxId = `{ottscott-distract-me-not-${uuid}@ottscott.dev}`;
    
    console.log('✅ Firefox ID generated:', firefoxId);
    
    return firefoxId;
  }

  /**
   * Update manifest files with new keys/IDs
   */
  updateManifests() {
    console.log('📝 Updating manifest files...');

    const chromeKey = this.generateChromeKey();
    const firefoxId = this.generateFirefoxId();

    // Note: Don't add the Chrome key to manifest.json for development
    // It should only be added during the Chrome Web Store publication process
    
    // Update Firefox manifest
    if (fs.existsSync(this.firefoxManifestPath)) {
      const firefoxManifest = JSON.parse(fs.readFileSync(this.firefoxManifestPath, 'utf8'));
      firefoxManifest.browser_specific_settings.gecko.id = firefoxId;
      
      fs.writeFileSync(
        this.firefoxManifestPath,
        JSON.stringify(firefoxManifest, null, 2)
      );
      
      console.log('✅ Updated Firefox manifest with new ID');
    }

    // Create instructions file
    const instructions = `
# Extension Keys Generated - ${new Date().toISOString()}

## Chrome Extension Key
- Public Key: ${chromeKey}
- Private Key: Saved in private-keys/chrome-extension-private.pem
- **IMPORTANT**: Do NOT commit the private key to version control!

## Firefox Extension ID
- ID: ${firefoxId}

## Next Steps for Rebranding:

### Chrome Web Store:
1. Remove any existing "key" field from manifest.json for development
2. When publishing to Chrome Web Store, use the private key to sign
3. Chrome will generate the extension ID from your public key

### Firefox Add-ons:
1. The manifest.firefox.json has been updated with the new ID
2. Submit to Mozilla Add-ons with the new ID

### Security Notes:
- Keep private-keys/ folder secure and never commit it
- Add private-keys/ to .gitignore
- Consider using environment variables for CI/CD

### Store Submissions:
- This creates a NEW extension, separate from the original
- You'll need new store listings for Chrome Web Store and Firefox Add-ons
- Update all branding, screenshots, and descriptions
`;

    fs.writeFileSync(
      path.join(this.projectRoot, 'EXTENSION-KEYS-README.md'),
      instructions
    );

    console.log('✅ Generated EXTENSION-KEYS-README.md with instructions');
  }

  /**
   * Update .gitignore to exclude private keys
   */
  updateGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    let gitignoreContent = '';
    
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    const keyExclusions = `

# Extension private keys (DO NOT COMMIT)
private-keys/
*.pem
EXTENSION-KEYS-README.md
`;
    
    if (!gitignoreContent.includes('private-keys/')) {
      fs.appendFileSync(gitignorePath, keyExclusions);
      console.log('✅ Updated .gitignore to exclude private keys');
    }
  }
}

// Main execution
if (require.main === module) {
  const generator = new ExtensionKeyGenerator();
  
  try {
    console.log('🚀 Starting extension key generation for rebranding...\n');
    
    generator.updateManifests();
    generator.updateGitignore();
    
    console.log('\n🎉 Extension rebranding keys generated successfully!');
    console.log('📖 Check EXTENSION-KEYS-README.md for next steps');
    console.log('⚠️  Remember to keep private keys secure!');
    
  } catch (error) {
    console.error('❌ Error generating extension keys:', error.message);
    process.exit(1);
  }
}

module.exports = { ExtensionKeyGenerator };
