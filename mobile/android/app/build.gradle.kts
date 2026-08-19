plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    // Firebase: reads app/google-services.json at build time so Firebase Cloud Messaging
    // (firebase-messaging, below) can resolve a real device push token.
    id("com.google.gms.google-services")
}

android {
    namespace = "com.quickin.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.quickin.app"
        minSdk = 26
        targetSdk = 35
        // Play rejects a versionCode that has EVER been used ("Version code N has already
        // been used"), and it can only ever increase — you can never go back down. Codes
        // 1 and 2 are burned. Rather than incrementing one at a time and burning an upload
        // per collision, this switches to a derived scheme: MAJOR*10000 + MINOR*100 + PATCH.
        // 1.2.0 → 10200. Every future bump follows the same formula from versionName, so a
        // collision is impossible as long as versionName goes up.
        versionCode = 10200
        // Kept in step with the iOS MARKETING_VERSION in mobile/ios/project.yml.
        versionName = "1.2.0"

        // Google Maps API key for the (optional) Google Maps Explore map. Defaults to "" so the
        // app builds and runs with the osmdroid price-pill fallback when no key is provided.
        // Supply one via -PMAPS_API_KEY=... or a `MAPS_API_KEY=...` line in gradle.properties /
        // ~/.gradle/gradle.properties. The same value should be mirrored into Config.MAPS_API_KEY
        // so the runtime picks the Google Maps path (see ui/ListingsMap.kt).
        manifestPlaceholders["MAPS_API_KEY"] =
            (project.findProperty("MAPS_API_KEY") as String?) ?: "AIzaSyBigDJt5v66YrCqY-kd-V7AdU8fJl3N5_I"
    }

    signingConfigs {
        // Debug signing with a keystore that lives IN THE REPO, on purpose.
        //
        // Without this, Gradle mints ~/.android/debug.keystore on whatever machine is
        // building — so every developer, and every fresh CI runner, produced an APK with a
        // DIFFERENT signing certificate. Google Sign-In authenticates the calling app by
        // (package name + signing SHA-1) against an OAuth "Android" client registered in the
        // Google Cloud console, so a fingerprint that changes per build can never be
        // registered: the picker opens, the account is chosen, and Play services returns
        // DEVELOPER_ERROR (status 10). That is exactly what the published `publishs/` APKs
        // did — two builds from the same day were signed with two different debug certs.
        //
        // Pinning the keystore here gives every build ONE fingerprint, registered once:
        //   SHA-1  D1:2E:E0:C1:DB:FD:18:9A:E4:27:54:0A:99:49:53:CF:A6:27:C6:87
        // Re-read it any time with:
        //   keytool -list -v -keystore app/debug.keystore -alias androiddebugkey -storepass android
        //
        // This is a debug key with the conventional android/androiddebugkey credentials — it
        // signs nothing that ships through Play, and it is no more secret than the stock
        // Android debug key it replaces. Store-bound builds use the `release` config below.
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }

        create("release") {
            // Release signing for a Play-Store-ready APK/AAB. The bundled
            // app/release.keystore is a self-signed dev keystore (passwords below are the
            // committed defaults). Override any value via -P flags or a gradle.properties /
            // ~/.gradle/gradle.properties entry: RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD,
            // RELEASE_KEY_ALIAS, RELEASE_KEY_PASSWORD. The keystore itself is git-ignored.
            storeFile = file(
                (project.findProperty("RELEASE_STORE_FILE") as String?) ?: "release.keystore"
            )
            storePassword =
                (project.findProperty("RELEASE_STORE_PASSWORD") as String?) ?: "quickin123"
            keyAlias =
                (project.findProperty("RELEASE_KEY_ALIAS") as String?) ?: "quickin"
            keyPassword =
                (project.findProperty("RELEASE_KEY_PASSWORD") as String?) ?: "quickin123"
        }
    }

    buildTypes {
        debug {
            // Defaults to the live Vercel backend (real data on the emulator, no local server).
            // To test against a local `npm run dev`, override at build time, e.g.:
            //   ./gradlew assembleDebug -PDEV_API_BASE_URL=http://192.168.8.24:3000   (real phone on Wi-Fi)
            //   ./gradlew assembleDebug -PDEV_API_BASE_URL=http://10.0.2.2:3000        (emulator)
            // The LAN IP must be listed in res/xml/network_security_config.xml (cleartext).
            val devApi = (project.findProperty("DEV_API_BASE_URL") as String?)
                ?: "https://quickin-backend.vercel.app"
            buildConfigField("String", "API_BASE_URL", "\"$devApi\"")
            // Explicit (AGP would default to this) so it is obvious that debug builds are
            // signed with the repo's pinned keystore, not a per-machine one — see above.
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            // Production API (deployed to Vercel).
            buildConfigField("String", "API_BASE_URL", "\"https://quickin-backend.vercel.app\"")
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")

    // Firebase Cloud Messaging — push notifications. The BOM pins a consistent set of Firebase
    // library versions; firebase-messaging supplies FirebaseMessaging (real device tokens,
    // resolved by PushTokenManager) and FirebaseMessagingService (QuickInMessagingService).
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
    // AppCompat — powers the in-app language switch via AndroidX per-app locales
    // (AppCompatDelegate.setApplicationLocales). MainActivity extends AppCompatActivity, and the
    // AppLocalesMetadataHolderService entry in the manifest auto-persists the choice on API < 33.
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("io.coil-kt:coil-compose:2.7.0")

    // ZXing — generates the QR bitmap shown on the in-app reservation card (detail screen).
    // Core only (no Android UI dependency); we render the BitMatrix into a Bitmap ourselves.
    implementation("com.google.zxing:core:3.5.3")

    // osmdroid — OpenStreetMap map view for the Explore "Map" mode. No API key required;
    // tiles are fetched over HTTPS from the public OSM tile servers. Requires a User-Agent
    // (set in MainActivity.onCreate via Configuration.getInstance().userAgentValue). This is the
    // always-available fallback that renders the Airbnb-style price pills.
    implementation("org.osmdroid:osmdroid-android:6.1.20")

    // Google Maps (key-gated) — used only when Config.MAPS_API_KEY is non-empty; otherwise the
    // osmdroid price-pill map above is used. From Google Maven (declared in settings.gradle.kts).
    implementation("com.google.android.gms:play-services-maps:19.0.0")
    implementation("com.google.maps.android:maps-compose:6.1.2")

    // Fused location provider — powers the "Use my current location" button in the
    // add-listing location picker (com.google.android.gms.location.LocationServices).
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // Chrome Custom Tabs — kept as a fallback dependency (deep-link handling still uses it).
    implementation("androidx.browser:browser:1.8.0")

    // Legacy Google Sign-In (play-services-auth) — reliable on all devices / all consent-screen
    // modes without requiring test-user whitelisting. Used via ActivityResultContracts.
    implementation("com.google.android.gms:play-services-auth:21.2.0")
    // Credential Manager — kept for future use / biometric passkey flows.
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // Biometric (fingerprint / face) sign-in. AndroidX BiometricPrompt drives the system
    // biometric dialog from a FragmentActivity/AppCompatActivity (MainActivity is AppCompat).
    implementation("androidx.biometric:biometric:1.1.0")
    // Encrypted storage for the biometric session (token + user JSON), keyed by the Android
    // Keystore. Used by BiometricAuthManager's EncryptedSharedPreferences.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    debugImplementation("androidx.compose.ui:ui-tooling")

    // Plain JVM unit tests (./gradlew :app:testDebugUnitTest). EmailRules/EmailData are pure
    // value logic with no Android dependency, so the address policy the sign-up button is gated
    // on can be run on the desktop JVM — the same way the backend twin is covered by
    // backend/quickin-backend/test/unit/email-core.test.mjs.
    testImplementation("junit:junit:4.13.2")
}
