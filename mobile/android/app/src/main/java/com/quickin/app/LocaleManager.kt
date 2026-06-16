package com.quickin.app

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * In-app language switch built on AndroidX per-app locales
 * (`AppCompatDelegate.setApplicationLocales`). Supported languages: English ("en") and
 * Arabic ("ar"); Arabic flips the whole UI to RTL automatically (Compose reads the layout
 * direction from the active configuration, and `android:supportsRtl="true"` is set in the
 * manifest).
 *
 * Persistence is handled by AppCompat itself: on API 33+ the system stores the per-app locale,
 * and on older versions the `AppLocalesMetadataHolderService` declared in AndroidManifest.xml
 * (with the `autoStoreLocales` meta-data) writes it to SharedPreferences. So a [setLanguage]
 * call survives process death and is re-applied on the next launch with no extra startup code.
 */
object LocaleManager {

    /** Supported UI languages. [tag] is the BCP-47 language tag used for the locale list. */
    enum class Language(val tag: String) {
        ENGLISH("en"),
        ARABIC("ar");

        companion object {
            /** Maps a language tag (e.g. "ar-EG", "en-US") back to a [Language], defaulting to English. */
            fun fromTag(tag: String?): Language =
                if (tag != null && tag.lowercase().startsWith("ar")) ARABIC else ENGLISH
        }
    }

    /** The language currently applied to the app (defaults to English when none is set). */
    fun currentLanguage(): Language {
        val locales = AppCompatDelegate.getApplicationLocales()
        return Language.fromTag(if (locales.isEmpty) null else locales[0]?.language)
    }

    /** Applies [language] app-wide and persists it. Compose re-composes (and re-flows RTL) on change. */
    fun setLanguage(language: Language) {
        if (language == currentLanguage()) return
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.tag))
    }
}
