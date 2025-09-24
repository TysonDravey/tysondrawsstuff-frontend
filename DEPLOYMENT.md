# Deployment Workflow

## Overview
We use a **develop → main** workflow to prevent changes from going directly to production.

## Branches

### `develop` (Staging)
- **Use for**: Testing new features, content changes, experiments
- **Auto-deploys to**: Vercel Preview URLs (safe to break)
- **Process**: Push changes → Gets preview URL → Test → Merge to main when ready

### `main` (Production)
- **Use for**: Only stable, tested changes
- **Auto-deploys to**: Live production site at tysondrawsstuff.com
- **Process**: Only receive changes via merge from develop

## Workflow

### For Testing Changes:
```bash
# Switch to develop branch
git checkout develop

# Make your changes...
# git add, git commit

# Push to get preview URL
git push origin develop
```
→ Vercel creates preview URL for testing

### For Going Live:
```bash
# After testing on develop, merge to main
git checkout main
git merge develop
git push origin main
```
→ Changes go live on production site

## Environment Variables
Both environments use the same Strapi backend for now. In the future, we could set up separate:
- **Preview**: Test Strapi instance
- **Production**: Live Strapi instance

## Benefits
✅ **Safe testing** - Preview changes before they go live
✅ **No more accidental production pushes**
✅ **Preview URLs** for sharing with others
✅ **Easy rollbacks** if needed