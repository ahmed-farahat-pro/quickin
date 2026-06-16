# Ship QuickIn iOS to TestFlight

The project is **TestFlight-ready**. App Store Connect record (already created):
- **App name:** Quickin-app
- **Bundle ID:** `com.quickin.ahmed`  ← now set in the project + verified in the archive
- **SKU:** Quick · **Apple ID:** 6778979967
- **Version / build:** 1.0.0 / 1 · **Encryption:** declared exempt (no TestFlight prompt) · **Icon:** ✅

> What's done for you: bundle id, version, export-compliance flag, HTTPS-only ATS, app icon, automatic-signing config. The project **archives cleanly** (verified). The only thing left is the *signed* archive + upload, which must run under **your** Apple account.

## Prerequisites (only you can do these)
1. **Apple Developer Program membership** ($99/yr) — required to upload. (You already created the App Store Connect record, so you likely have it.)
2. **Xcode** on this Mac, signed in with your Apple ID (Xcode ▸ Settings ▸ Accounts ▸ +).

---

## Easiest path — Xcode GUI (recommended)

```bash
cd /Users/ahmedfarahat/Downloads/quickin-master/mobile/ios
xcodegen generate
open QuickIn.xcodeproj
```

In Xcode:
1. Select the **QuickIn** target → **Signing & Capabilities** tab.
2. Tick **Automatically manage signing** → choose your **Team** from the dropdown.
   - Xcode creates the distribution certificate + provisioning profile for `com.quickin.ahmed`.
   - If it says the bundle id isn't registered, click **Register** (or it's already registered from your App Store Connect record).
3. In the top device bar choose **Any iOS Device (arm64)** (NOT a simulator).
4. Menu **Product → Archive**. Wait for the build to finish — the **Organizer** opens.
5. Select the new archive → **Distribute App** → **App Store Connect** → **Upload** → keep the defaults (automatic signing) → **Upload**.
6. Wait ~5–15 min for Apple to process the build.
7. **App Store Connect → Quickin-app → TestFlight** tab:
   - The build appears (status "Processing" → "Ready to Test").
   - Export compliance auto-clears (we declared it exempt).
   - Add yourself under **Internal Testing** → install the **TestFlight** app on your iPhone → test QuickIn. 🎉

---

## Advanced path — command line (optional)
Set your Team ID in `project.yml` (uncomment `DEVELOPMENT_TEAM:`) and in `ExportOptions.plist`, then:

```bash
cd /Users/ahmedfarahat/Downloads/quickin-master/mobile/ios
xcodegen generate

# 1) Archive (signed)
xcodebuild -project QuickIn.xcodeproj -scheme QuickIn -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/QuickIn.xcarchive archive

# 2) Export the .ipa
xcodebuild -exportArchive -archivePath build/QuickIn.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export

# 3) Upload (needs an App Store Connect API key: ASC → Users and Access → Integrations → Keys)
xcrun altool --upload-app -t ios -f build/export/QuickIn.ipa \
  --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
```

---

## Notes
- **Next build:** before uploading again, bump `CURRENT_PROJECT_VERSION` in `project.yml` (1 → 2) — App Store Connect rejects a re-used build number.
- **Backend:** the app already points at `https://quickin-backend.vercel.app` (see `Sources/Config.swift`). Make sure that backend is live before testers use auth.
- **Google / Apple sign-in:** when you wire these later, the Apple **App ID** and the **Google iOS client** must use the new bundle id `com.quickin.ahmed` (not the old `com.quickin.app`).
- I cannot enter Apple credentials or run the signed upload for you — that's the one manual step above.
