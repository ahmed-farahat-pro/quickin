package com.quickin.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [GoogleSignInErrors] — the copy a failed Google sign-in shows.
 *
 * Filed as "[Android] Sign in with Google Fails". The root cause was off-device: every CI run
 * built the published APK with a freshly generated debug keystore, so each build carried a
 * different signing SHA-1 and none of them could be registered as an OAuth Android client.
 * Play services answered every attempt with DEVELOPER_ERROR (10), and all the app said was
 * "Google sign-in failed (code 10)" — which is why the bug came back three times looking like
 * an app defect. `app/debug.keystore` pins the fingerprint; these tests pin the *diagnosis*, so
 * a future recurrence names itself in the bug report instead of hiding behind a number.
 *
 * Pure value logic — no Android framework, no Play services — so it runs on the desktop JVM via
 * `./gradlew :app:testDebugUnitTest`.
 */
class GoogleSignInErrorsTest {

    @Test
    fun `developer error explains the signing mismatch rather than printing a code`() {
        val msg = GoogleSignInErrors.message(GoogleSignInErrors.DEVELOPER_ERROR)
        assertTrue("should name the app package", msg.contains("com.quickin.app"))
        assertTrue("should point at the signing certificate", msg.contains("signing certificate"))
        // The whole point: a tester must not be left holding a bare number.
        assertFalse("should not surface the raw code", msg.contains("code 10"))
    }

    @Test
    fun `developer error carries the build's fingerprint when it is known`() {
        val sha1 = "D1:2E:E0:C1:DB:FD:18:9A:E4:27:54:0A:99:49:53:CF:A6:27:C6:87"
        val msg = GoogleSignInErrors.message(GoogleSignInErrors.DEVELOPER_ERROR, sha1)
        assertTrue("the fingerprint is the value to register", msg.contains(sha1))
    }

    @Test
    fun `developer error stays readable when the fingerprint could not be read`() {
        for (missing in listOf(null, "", "   ")) {
            val msg = GoogleSignInErrors.message(GoogleSignInErrors.DEVELOPER_ERROR, missing)
            assertFalse("no empty parenthetical", msg.contains("()"))
            assertFalse("no null leaking into the UI", msg.contains("null"))
        }
    }

    @Test
    fun `network failure tells the user to check their connection`() {
        val msg = GoogleSignInErrors.message(GoogleSignInErrors.NETWORK_ERROR)
        assertTrue(msg.contains("internet connection"))
    }

    @Test
    fun `missing play services steers the user to email and password`() {
        val msg = GoogleSignInErrors.message(GoogleSignInErrors.API_NOT_CONNECTED)
        assertTrue(msg.contains("Google Play services"))
        assertTrue(msg.contains("email and password"))
    }

    @Test
    fun `an unknown code still keeps the number so a report can identify it`() {
        val msg = GoogleSignInErrors.message(4242)
        assertTrue(msg.contains("4242"))
    }

    @Test
    fun `every mapped code produces distinct actionable copy`() {
        val codes = listOf(
            GoogleSignInErrors.DEVELOPER_ERROR,
            GoogleSignInErrors.NETWORK_ERROR,
            GoogleSignInErrors.API_NOT_CONNECTED,
            GoogleSignInErrors.SIGN_IN_CURRENTLY_IN_PROGRESS,
        )
        val generic = GoogleSignInErrors.message(4242)
        for (code in codes) {
            assertNotEquals("code $code fell through to the generic message", generic, GoogleSignInErrors.message(code))
        }
    }

    @Test
    fun `backing out of the picker is a cancellation, a real failure is not`() {
        assertTrue(GoogleSignInErrors.isCancellation(GoogleSignInErrors.SIGN_IN_CANCELLED))
        assertTrue(GoogleSignInErrors.isCancellation(GoogleSignInErrors.CANCELED))
        assertTrue(GoogleSignInErrors.isCancellation(GoogleSignInErrors.SIGN_IN_REQUIRED))
        assertFalse(GoogleSignInErrors.isCancellation(GoogleSignInErrors.DEVELOPER_ERROR))
        assertFalse(GoogleSignInErrors.isCancellation(GoogleSignInErrors.NETWORK_ERROR))
    }
}
