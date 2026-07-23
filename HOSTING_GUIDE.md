# Hosting and Auto-Updates Guide

This guide details the final steps required to host your application releases and enable auto-updates for the Mintzy Plugin desktop app.

## 1. Create an S3 Bucket
The application is configured to use Amazon S3 as the release host.
1. Log in to your AWS Console and navigate to S3.
2. Create a new bucket (e.g., `mintzy-releases`).
3. Ensure the bucket has **public-read** access so the app can download updates without requiring authentication.

## 2. Update Application Configuration
Open `electron-builder.yml` at the root of your project and update the `publish` block with your real S3 details:

```yaml
publish:
  provider: s3
  bucket: your-actual-bucket-name
  region: your-actual-region
  acl: public-read
```

## 3. Publishing a Release
When you are ready to publish a new version of the app to your users:

1. **Increment Version**: Open `package.json` and increase the `version` number.
2. **Build the App**: Run the build command (e.g., `npm run build`). This will generate your installers in the `release/` folder.
3. **Upload Files**: Upload BOTH the generated installer file (e.g., `.exe` or `.dmg`) AND the `latest.yml` (or `latest-mac.yml`) file to your S3 bucket.

## How Auto-Updates Work
- The auto-updater only checks for updates in **production builds** (`if (!isDev)`). You will not see update prompts while developing locally.
- When an update is detected, it is downloaded silently in the background.
- Once downloaded, the user is prompted with a native dialog to either "Restart and Install Now" or install it "Later".
