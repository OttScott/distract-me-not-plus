## 🚀 Distract Me Not v3.14.2

### 🛡️ Critical Data Loss Protection (THE BIG FIX!)

This release includes a **game-changing fix** that permanently solves the catastrophic data loss bug that could wipe out your rules across all machines.

**The Problem We Solved:**
- When you uninstalled the extension on one machine, Chrome would delete all sync storage data from the cloud
- Within seconds, all your other machines would sync this empty state and lose ALL rules
- Users lost hundreds of carefully configured blocking rules with no recovery

**The Solution:**
This release implements a **4-layer data loss protection system** that detects and prevents this catastrophic scenario:

1. **🚨 Cross-Device Protection** - When Machine B detects that sync storage is trying to set rules to empty while local storage has rules, it:
   - Immediately **rejects** the empty data
   - **Restores** the cloud from its local backup
   - Logs: `🚨 CATASTROPHIC DATA LOSS DETECTED!`
   - Your rules are **saved automatically**!

2. **⏱️ Fresh Install Protection** - New 15-minute grace period after installation prevents accidental overwrites

3. **📊 Metadata Verification** - Checks existing chunked data before any write operations

4. **🔍 Dechunk Safety** - Final verification layer for corrupted metadata scenarios

**Tested & Confirmed:** Successfully prevented data loss in real-world testing with 258 rules preserved and cloud restored within seconds.

### ✨ Other Improvements

**UI Enhancements:**
- 🔘 **Sync Status Button** now appears in password-protected mode
- 🔗 Updated all GitHub links to point to the new maintainer (OttScott)
- 📊 Real-time sync status with visual health indicators

**Bug Fixes:**
- ✅ Fixed detection of key deletion (undefined) vs empty arrays in sync events
- ✅ Fixed SyncStatusButton test expectations
- ✅ Improved diagnostic logging for troubleshooting

### 📚 Documentation

New comprehensive documentation added:
- `UNINSTALL-DATA-LOSS-PROTECTION.md` - Complete technical details of all protection layers
- Test results and recovery scenarios
- Development best practices to avoid data loss

### 🌐 Browser Support

- 🦊 **Firefox** - `distract_me_not-3.1.3-firefox.zip`
- 🌐 **Chrome** - `distract_me_not-3.14.2-chrome.zip`  
- 📘 **Edge** - `distract_me_not-3.14.2-edge.zip`

### 📥 Installation

1. Download the appropriate ZIP file for your browser
2. Extract the ZIP file
3. **Chrome/Edge:** 
   - Go to `chrome://extensions` or `edge://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extracted folder
4. **Firefox:**
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select any file from the extracted folder

### ⚠️ Important Note for Developers

**Never use "Uninstall" for testing during development!** This will delete cloud storage. Instead:
- Use the **"Reload"** button in `chrome://extensions`
- This keeps all your storage data intact
- See `UNINSTALL-DATA-LOSS-PROTECTION.md` for details

### 🔧 Technical Details

- Built with Node.js 18
- React 18 with Evergreen UI
- Manifest V3 compatible
- 187 passing tests (100% of test suite)
- Security scanned and validated
- Zero high/critical vulnerabilities

### 📝 Full Changelog

**Features:**
- Add catastrophic data loss detection and recovery system
- Add cross-device uninstall protection with automatic cloud restoration
- Add extended fresh install protection (2min → 15min)
- Add SyncStatusButton to password-protected popup
- Add comprehensive sync diagnostic logging

**Bug Fixes:**
- Fix undefined vs empty array detection in sync change handler
- Fix SyncStatusButton test to match actual log format
- Fix release workflow GitHub Action (ncipollo → softprops)

**Maintenance:**
- Update all GitHub links from AXeL-dev to OttScott
- Update documentation with confirmed test results
- Add UNINSTALL-DATA-LOSS-PROTECTION.md guide

---

**Previous Version:** v3.1.1  
**Release Date:** January 29, 2026  
**Commits:** 4 commits since last release  
**Contributors:** @OttScott

For detailed technical information, see [UNINSTALL-DATA-LOSS-PROTECTION.md](https://github.com/OttScott/distract-me-not/blob/master/UNINSTALL-DATA-LOSS-PROTECTION.md)
