plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.quickin.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.quickin.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        // Google Maps API key for the (optional) Google Maps Explore map. Defaults to "" so the
        // app builds and runs with the osmdroid price-pill fallback when no key is provided.
        // Supply one via -PMAPS_API_KEY=... or a `MAPS_API_KEY=...` line in gradle.properties /
        // ~/.gradle/gradle.properties. The same value should be mirrored into Config.MAPS_API_KEY
        // so the runtime picks the Google Maps path (see ui/ListingsMap.kt).
        manifestPlaceholders["MAPS_API_KEY"] =
            (project.findProperty("MAPS_API_KEY") as String?) ?: ""
    }

    signingConfigs {
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
            // Local Next.js dev server, reached from the emulator via the host alias 10.0.2.2.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000\"")
        }
        release {
            // Production API. Replace with your deployed Vercel URL before shipping.
            buildConfigField("String", "API_BASE_URL", "\"https://REPLACE-WITH-YOUR-VERCEL-URL\"")
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

    // osmdroid — OpenStreetMap map view for the Explore "Map" mode. No API key required;
    // tiles are fetched over HTTPS from the public OSM tile servers. Requires a User-Agent
    // (set in MainActivity.onCreate via Configuration.getInstance().userAgentValue). This is the
    // always-available fallback that renders the Airbnb-style price pills.
    implementation("org.osmdroid:osmdroid-android:6.1.20")

    // Google Maps (key-gated) — used only when Config.MAPS_API_KEY is non-empty; otherwise the
    // osmdroid price-pill map above is used. From Google Maven (declared in settings.gradle.kts).
    implementation("com.google.android.gms:play-services-maps:19.0.0")
    implementation("com.google.maps.android:maps-compose:6.1.2")

    // Chrome Custom Tabs — used to launch the Google OAuth consent flow in-browser
    // (config-gated; only invoked when Config.GOOGLE_CLIENT_ID is set).
    implementation("androidx.browser:browser:1.8.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
