plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    // Google Services — processes app/google-services.json (Firebase project quickin-4baea) so
    // Firebase Cloud Messaging can resolve a real device token. Applied in app/build.gradle.kts.
    id("com.google.gms.google-services") version "4.4.2" apply false
}
