# Quick Start: Triggering Builds and Releases

## 🚀 **Triggering Builds**

### Automatic Builds
Your CI pipeline automatically runs when you:
```bash
# Push to main branches
git push origin Features
git push origin master
git push origin develop

# Create/update pull requests
# (automatically triggered by GitHub)
```

### Manual Builds
1. **Via GitHub Web Interface:**
   - Go to [GitHub Actions](https://github.com/OttScott/distract-me-not/actions)
   - Click "Continuous Integration" workflow
   - Click "Run workflow" button
   - Choose your options and run

2. **Via Command Line (triggers automatic build):**
```bash
# Push any changes to trigger CI
git add .
git commit -m "trigger build"
git push
```

## 🎯 **Creating Releases**

### Method 1: Semantic Versioning (Recommended)
```bash
# Patch release (3.1.1 → 3.1.2)
npm version patch
git push origin --tags

# Minor release (3.1.1 → 3.2.0)  
npm version minor
git push origin --tags

# Major release (3.1.1 → 4.0.0)
npm version major
git push origin --tags
```

### Method 2: Manual Git Tags
```bash
# Create and push a version tag
git tag v3.1.2
git push origin v3.1.2

# Or create an annotated tag with message
git tag -a v3.1.2 -m "Release version 3.1.2"
git push origin v3.1.2
```

### Method 3: GitHub Actions Manual Trigger
1. Go to [GitHub Actions](https://github.com/OttScott/distract-me-not/actions)
2. Click "Build and Release" workflow
3. Click "Run workflow"
4. Select:
   - **Release type**: patch/minor/major
   - **Force release**: true (to bypass checks if needed)
5. Click "Run workflow"

## 📦 **What Happens During a Release**

When you trigger a release, the pipeline will:

1. ✅ **Quality Checks** - Run linting and tests
2. 🔧 **Multi-Browser Builds** - Build for Firefox, Chrome, and Edge
3. 📦 **Package Extensions** - Create ZIP files for each browser
4. 🚀 **Create GitHub Release** - With auto-generated release notes
5. 📤 **Upload Artifacts** - Extension files ready for distribution

## 📥 **Accessing Release Artifacts**

After a successful release:

1. **GitHub Releases Page:**
   - Go to [Releases](https://github.com/OttScott/distract-me-not/releases)
   - Download the browser-specific ZIP files

2. **GitHub Actions Artifacts:**
   - Go to the specific workflow run
   - Download artifacts from the "Artifacts" section

## 🔍 **Monitoring Your Builds**

### Real-time Monitoring
- **GitHub Actions Tab**: See all running/completed workflows
- **Slack Notifications**: Get alerts for failures (if configured)
- **Email Notifications**: GitHub sends emails for failed workflows

### Health Monitoring
- **Weekly Reports**: Automated pipeline health reports
- **Issue Creation**: Automatic issues for critical failures
- **Security Alerts**: Daily security scans with notifications

## 🛠️ **Testing Your Setup**

### Test Build Pipeline
```bash
# Make a small change and push
echo "// CI/CD test" >> src/test-file.js
git add .
git commit -m "test: verify CI/CD pipeline"
git push origin cicd-pipeline
```

### Test Release Pipeline
```bash
# Create a test release
git tag v3.1.1-test
git push origin v3.1.1-test
```

## 🔧 **Troubleshooting**

### Build Failures
1. Check the GitHub Actions logs
2. Run tests locally: `npm run validate`
3. Fix issues and push again

### Release Failures
1. Ensure all quality checks pass
2. Check for proper version format (v*.*.*)
3. Verify GitHub token permissions

### Need Help?
- Check [CI/CD Documentation](./CI-CD-DOCUMENTATION.md)
- Create an issue using the CI/CD template
- Review workflow logs in GitHub Actions

---

## 🚀 **Quick Commands Summary**

```bash
# Build & Test Locally
npm run validate

# Create Patch Release
npm version patch && git push origin --tags

# Create Minor Release  
npm version minor && git push origin --tags

# Create Major Release
npm version major && git push origin --tags

# Force Push Current Branch (triggers CI)
git push origin $(git branch --show-current)
```
