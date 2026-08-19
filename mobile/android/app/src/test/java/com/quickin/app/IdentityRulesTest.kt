package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [IdentityRules] — what the become-a-host form puts in its
 * National ID field, given the identity we already hold.
 *
 * Filed as "[Android] Identity Verification Is Duplicated Between Profile and
 * Become a Host Flow": identity is verified once, from the Profile tab, and
 * serves guest and host alike — but the application then asked a verified user
 * to retype the very number an admin had already approved.
 *
 * The cases below are the Kotlin mirror of the backend's
 * `test/unit/host-verification-core.test.mjs` (`nationalIdForApplication`),
 * which the website runs too. All three forms write the same
 * `host_applications.national_id`, so a rule that only holds on one of them is
 * not a rule. Pure value logic — no Android framework, no network — so this runs
 * on the desktop JVM via `./gradlew :app:testDebugUnitTest`.
 */
class IdentityRulesTest {

    @Test
    fun `a verified number is shown, not asked for`() {
        // The number an admin already approved. Asking for it again invites an
        // application that contradicts the document sitting next to it in /ops.
        val field = IdentityRules.nationalId("verified", "29801011234567")
        assertEquals("29801011234567", field.value)
        assertTrue(field.locked)
    }

    @Test
    fun `a verified applicant whose submission carried no number still types one`() {
        // id_number is optional on a submission; locking an empty field would
        // leave the applicant unable to fill in a required one.
        val field = IdentityRules.nationalId("verified", "   ")
        assertEquals("", field.value)
        assertFalse(field.locked)
    }

    @Test
    fun `a pending or rejected submission seeds the field but never locks it`() {
        // Nothing is approved yet, so this is a convenience, not a decision.
        for (status in listOf("pending", "rejected")) {
            val field = IdentityRules.nationalId(status, "123")
            assertEquals("123", field.value)
            assertFalse(field.locked)
        }
    }

    @Test
    fun `a reapply keeps what was typed last time`() {
        val field = IdentityRules.nationalId("pending", "111", previousNationalId = "222")
        assertEquals("222", field.value)
        assertFalse(field.locked)
    }

    @Test
    fun `a verified number outranks the previous application`() {
        // The approved document wins over whatever a rejected application said.
        val field = IdentityRules.nationalId("verified", "111", previousNationalId = "222")
        assertEquals("111", field.value)
        assertTrue(field.locked)
    }

    @Test
    fun `nothing on file leaves an empty, editable field`() {
        val field = IdentityRules.nationalId(null, null, null)
        assertEquals("", field.value)
        assertFalse(field.locked)
    }

    @Test
    fun `an unknown status never locks the field`() {
        // Anything unrecognised reads as unverified — never assume an approval.
        val field = IdentityRules.nationalId("nonsense", "123")
        assertEquals("123", field.value)
        assertFalse(field.locked)
    }

    @Test
    fun `values are trimmed and the status read case-insensitively`() {
        val field = IdentityRules.nationalId(" VERIFIED ", "  123  ")
        assertEquals("123", field.value)
        assertTrue(field.locked)
    }

    // ---- The documents themselves -------------------------------------------
    // Filed as "[Android] Become a Host Application Can Be Submitted Without
    // Required ID Documents": the form collected no document at all and the API
    // accepted the application anyway, so an application could reach the admin
    // queue with nothing for the reviewer to read the declared name against.
    // Mirrors `needsIdentityDocuments` / `checkApplicationIdentity` in the
    // backend's host-verification-core, which now refuses exactly this.

    @Test
    fun `a first-time applicant must photograph their ID`() {
        assertTrue(IdentityRules.needsIdentityDocuments("unverified"))
    }

    @Test
    fun `a rejected submission has to be replaced`() {
        // "These are not good enough" — refiling the same row would put the same
        // refused photos back in front of the reviewer.
        assertTrue(IdentityRules.needsIdentityDocuments("rejected"))
    }

    @Test
    fun `a verified or pending identity is not asked for twice`() {
        // Verified is already approved; pending is already in the queue and is
        // decided together with the application.
        assertFalse(IdentityRules.needsIdentityDocuments("verified"))
        assertFalse(IdentityRules.needsIdentityDocuments("pending"))
    }

    @Test
    fun `an unknown or missing status asks for the documents`() {
        // The safe direction: an upload we did not need costs a photo, a document
        // we did need costs the applicant a refused request.
        assertTrue(IdentityRules.needsIdentityDocuments(null))
        assertTrue(IdentityRules.needsIdentityDocuments(""))
        assertTrue(IdentityRules.needsIdentityDocuments("something-else"))
    }

    @Test
    fun `the status is read case-insensitively and trimmed`() {
        assertFalse(IdentityRules.needsIdentityDocuments("  VERIFIED "))
        assertFalse(IdentityRules.needsIdentityDocuments("Pending"))
    }

    @Test
    fun `document types carry the API's own vocabulary`() {
        // The reviewer checks the photo against the declared type, and the server
        // refuses an unknown one, so these strings have to be exactly its keys.
        assertEquals("national_id", IdDocType.NationalId.apiValue)
        assertEquals("passport", IdDocType.Passport.apiValue)
        assertEquals("residence_permit", IdDocType.ResidencePermit.apiValue)
        assertEquals(IdDocType.Passport, IdDocType.from("PASSPORT"))
        assertEquals(IdDocType.NationalId, IdDocType.from("drivers_licence"))
    }
}
