/**
 * This script prepares the Chrome build by ensuring libraries are available
 * and properly referenced in the HTML instead of inlined
 * 
 * This script replaces the previous approach of inlining libraries
 * which didn't work with Chrome's Content Security Policy.
 */

// Polyfill for Node.js 16 compatibility
if (typeof ReadableStream === 'undefined' && parseInt(process.version.slice(1)) < 18) {
  try {
    const { ReadableStream } = require('web-streams-polyfill/ponyfill');
    global.ReadableStream = ReadableStream;
  } catch (e) {
    // If polyfill isn't available, continue anyway
    console.warn('Warning: ReadableStream polyfill not available for Node.js 16');
  }
}

const fs = require('fs');
const path = require('path');

// Check if cheerio is available, if not suggest installing it or use fallback
let cheerio;
try {
  cheerio = require('cheerio');
  
  // Test cheerio compatibility with a simple load operation
  const testHtml = '<div>test</div>';
  const $ = cheerio.load(testHtml);
  
  // Verify essential cheerio methods are available
  if (!$ || typeof $.html !== 'function') {
    throw new Error('Cheerio API incompatible - missing required methods');
  }
  
  console.log('✅ Cheerio loaded successfully');
} catch (e) {
  console.error('❌ Error loading cheerio:', e.message);
  
  // Provide better error context
  if (e.message.includes('Cannot find module')) {
    console.error('   → Install cheerio: npm install cheerio --save-dev');
  } else if (e.message.includes('File is not defined') || e.message.includes('Cheerio API incompatible')) {
    console.error('   → Cheerio version compatibility issue detected');
    console.error('   → Try: npm install cheerio@latest --save-dev');
  }
  
  // For Node.js 18+, we prefer cheerio but can fall back to string replacement
  console.log('📝 Falling back to string replacement method');
  cheerio = null;
}

// Paths
const BUILD_DIR = path.join(__dirname, '../build');
const INDEX_HTML = path.join(BUILD_DIR, 'index.html');
const STATIC_JS_DIR = path.join(BUILD_DIR, 'static/js');
const BROWSER_POLYFILL_SRC = path.join(__dirname, '../node_modules/webextension-polyfill/dist/browser-polyfill.min.js');
const BCRYPT_SRC = path.join(__dirname, '../node_modules/bcryptjs/dist/bcrypt.min.js');

// Ensure static/js directory exists
if (!fs.existsSync(STATIC_JS_DIR)) {
  fs.mkdirSync(STATIC_JS_DIR, { recursive: true });
}

// Copy library files to the build directory
function copyLibraryFiles() {
  console.log('Copying library files to build directory...');
  
  // Copy browser-polyfill.min.js to static/js
  try {
    fs.copyFileSync(BROWSER_POLYFILL_SRC, path.join(STATIC_JS_DIR, 'browser-polyfill.min.js'));
    fs.copyFileSync(BROWSER_POLYFILL_SRC, path.join(BUILD_DIR, 'browser-polyfill.min.js'));
    console.log('✓ Copied browser-polyfill.min.js');
  } catch (error) {
    console.error('❌ Error copying browser-polyfill.min.js:', error.message);
    return false;
  }
    // Copy bcrypt.min.js to static/js
  try {
    fs.copyFileSync(BCRYPT_SRC, path.join(STATIC_JS_DIR, 'bcrypt.min.js'));
    fs.copyFileSync(BCRYPT_SRC, path.join(BUILD_DIR, 'bcrypt.min.js'));
    console.log('✓ Copied bcrypt.min.js');
  } catch (error) {
    console.error('❌ Error copying bcrypt.min.js:', error.message);
    return false;
  }
    // Copy diagnostic files
  try {    // List of diagnostic files to copy with their source directories
    // Path is relative to project root
    const diagnosticFiles = [
      { file: 'sync-diagnostics.html', source: '' },
      { file: 'sync-diagnostics-debug.html', source: '' },
      { file: 'sync-status.html', source: '' },
      { file: 'test-sync-rules.js', source: '' },
      { file: 'run-sync-test.js', source: 'public' },
      { file: 'communication-test.html', source: '' }
    ];
    
    let missingFiles = [];
    let copiedFiles = [];
    
    for (const item of diagnosticFiles) {
      const file = item.file;
      const sourcePath = item.source 
        ? path.join(__dirname, '..', item.source, file) 
        : path.join(__dirname, '..', file);
      const destPath = path.join(BUILD_DIR, file);
      
      // Check if source file exists before copying
      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, destPath);
          copiedFiles.push(file);
          console.log(`✓ Copied ${file} from ${item.source || 'root'} directory`);
        } catch (copyError) {
          console.error(`❌ Error copying ${file}:`, copyError.message);
        }
      } else {
        missingFiles.push(file);
        console.warn(`⚠️ Warning: Source file ${file} not found at ${sourcePath}, skipping`);
      }
    }
    
    if (copiedFiles.length > 0) {
      console.log(`✅ Successfully copied ${copiedFiles.length} diagnostic files`);
    }
    
    if (missingFiles.length > 0) {
      console.warn(`⚠️ Warning: ${missingFiles.length} diagnostic files were not found: ${missingFiles.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Error in diagnostic files copy process:', error.message);
    // Continue build even if diagnostic files fail to copy
  }
  
  return true;
}

// Update the HTML file to use script references instead of inline scripts
function updateHtmlFile() {
  console.log('Updating HTML file to use script references instead of inline scripts...');
  
  try {
    // Read the HTML file
    const htmlContent = fs.readFileSync(INDEX_HTML, 'utf8');
    
    if (cheerio) {
      // Use cheerio for robust HTML manipulation
      console.log('Using cheerio for HTML manipulation...');
      
      try {
        // Load HTML into cheerio
        const $ = cheerio.load(htmlContent);
        
        // Remove any existing script tags for these libraries
        $('script').each(function() {
          const src = $(this).attr('src');
          if (
            src &&
            (
              src.includes('browser-polyfill.min.js') ||
              src.includes('bcrypt.min.js')
            )
          ) {
            $(this).remove();
          }
        });
        
        // Remove any inlined libraries
        $('script').each(function() {
          const content = $(this).html();
          if (
            content &&
            (
              content.includes('webextension-polyfill') ||
              content.includes('bcrypt.js')
            )
          ) {
            $(this).remove();
          }
        });
        
        // Add new script tags at the beginning of body
        $('body').prepend(`
          <script src="/static/js/bcrypt.min.js"></script>
          <script src="/static/js/browser-polyfill.min.js"></script>
        `);
        
        // Write the modified HTML
        fs.writeFileSync(INDEX_HTML, $.html());
        console.log('✓ Updated HTML file with script references using cheerio');
        return true;
        
      } catch (cheerioError) {
        console.error('❌ Error using cheerio:', cheerioError.message);
        console.log('📝 Falling back to string replacement method');
        cheerio = null; // Fall back to string replacement
      }
    }
    
    if (!cheerio) {
      // Fallback: Use simple string replacement
      console.log('Using simple string replacement for HTML manipulation...');
      
      let modifiedContent = htmlContent;
      
      // Add script tags at the beginning of body if they don't already exist
      if (!modifiedContent.includes('/static/js/bcrypt.min.js') && !modifiedContent.includes('/static/js/browser-polyfill.min.js')) {
        // Find the opening body tag and add scripts after it
        const bodyRegex = /<body[^>]*>/i;
        const bodyMatch = modifiedContent.match(bodyRegex);
        
        if (bodyMatch) {
          // Sanitize and validate the matched body tag
          const bodyTag = bodyMatch[0];
          
          // Only proceed if the body tag looks valid (basic validation)
          if (bodyTag.startsWith('<body') && bodyTag.endsWith('>')) {
            const scriptsToAdd = `
      <script src="/static/js/bcrypt.min.js"></script>
      <script src="/static/js/browser-polyfill.min.js"></script>`;
            
            modifiedContent = modifiedContent.replace(bodyRegex, bodyTag + scriptsToAdd);
            
            // Write the modified HTML
            fs.writeFileSync(INDEX_HTML, modifiedContent);
            console.log('✓ Updated HTML file with script references using string replacement');
          } else {
            console.warn('⚠️ Body tag validation failed, HTML file not modified');
            return false;
          }
        } else {
          console.warn('⚠️ Could not find body tag, HTML file not modified');
          return false;
        }
      } else {
        console.log('✓ Script references already exist in HTML file');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error updating HTML file:', error.message);
    return false;
  }
}

// Main execution
console.log('Preparing Chrome build...');
if (copyLibraryFiles() && updateHtmlFile()) {
  console.log('✅ Chrome build preparation completed successfully');
} else {
  console.error('❌ Chrome build preparation failed');
  process.exit(1);
}
