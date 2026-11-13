package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the signup-identity rules: phone format (port of the backend's `phone-core.ts`),
 * document numbers (`normalizeDocumentNumber` in `id-change-core.ts`), the identity state every auth
 * response carries (`identityState` in `signup-identity-core.ts`) and the booking refusal codes.
 * Pure JVM — `./gradlew :app:testDebugUnitTest`.
 */
class SignupIdentityRulesTest {

    // ---- PhoneRules ---------------------------------------------------------------------------

    @Test
    fun `an Egyptian mobile written three ways is one number`() {
        assertEquals("01012345678", PhoneRules.normalize("010 1234 5678"))
        assertEquals("01012345678", PhoneRules.normalize("+20 10 1234 5678"))
        assertEquals("01012345678", PhoneRules.normalize("0020-10-1234-5678"))
    }

    @Test
    fun `Arabic-Indic and Persian digits are digits`() {
        assertEquals("01012345678", PhoneRules.normalize("٠١٠١٢٣٤٥٦٧٨"))
        assertEquals("01012345678", PhoneRules.normalize("۰۱۰۱۲۳۴۵۶۷۸"))
        assertEquals("0101", PhoneRules.toAsciiDigits("٠١٠١"))
    }

    @Test
    fun `a mobile missing a digit is refused`() {
        assertNull(PhoneRules.normalize("0101234567"))
    }

    @Test
    fun `letters, blanks and too-short numbers are not phone numbers`() {
        assertNull(PhoneRules.normalize("asdf"))
        assertNull(PhoneRules.normalize(""))
        assertNull(PhoneRules.normalize(null))
        assertNull(PhoneRules.normalize("+++"))
        assertNull(PhoneRules.normalize("+1234567"))
        assertFalse(PhoneRules.isValid("010-CALL-ME"))
    }

    @Test
    fun `an international number keeps E164 form`() {
        assertEquals("+447911123456", PhoneRules.normalize("+44 7911 123456"))
        assertNull(PhoneRules.normalize("+1234567890123456")) // 16 digits
    }

    @Test
    fun `an Egyptian landline is accepted`() {
        assertEquals("0223456789", PhoneRules.normalize("02 2345 6789"))
    }

    @Test
    fun `the input filter drops letters and keeps a leading plus only`() {
        assertEquals("+20 10", PhoneRules.filterInput("+20 a10"))
        assertEquals("0101", PhoneRules.filterInput("٠١x٠١"))
        assertEquals("2010", PhoneRules.filterInput("20+10"))
        assertEquals(PhoneRules.MAX_PHONE_CHARS, PhoneRules.filterInput("1".repeat(40)).length)
    }

    // ---- DocumentNumberRules ------------------------------------------------------------------

    @Test
    fun `a national ID is exactly 14 digits`() {
        assertNull(DocumentNumberRules.problemWith("29801011234567", IdDocType.NationalId))
        assertNull(DocumentNumberRules.problemWith("2980 1011 2345-67", IdDocType.NationalId))
        assertNull(DocumentNumberRules.problemWith("٢٩٨٠١٠١١٢٣٤٥٦٧", IdDocType.NationalId))
        assertEquals(
            DocumentNumberRules.Problem.NationalIdLength,
            DocumentNumberRules.problemWith("2980101123456", IdDocType.NationalId)
        )
        assertEquals(
            DocumentNumberRules.Problem.NationalIdDigitsOnly,
            DocumentNumberRules.problemWith("A2980101123456", IdDocType.NationalId)
        )
        assertEquals(DocumentNumberRules.Problem.Empty, DocumentNumberRules.problemWith("  ", IdDocType.NationalId))
    }

    @Test
    fun `a passport or residence permit is 5 to 24 letters and digits`() {
        assertNull(DocumentNumberRules.problemWith("a12345", IdDocType.Passport))
        assertNull(DocumentNumberRules.problemWith("RP-99 8877", IdDocType.ResidencePermit))
        assertEquals(DocumentNumberRules.Problem.Length, DocumentNumberRules.problemWith("A123", IdDocType.Passport))
        assertEquals(
            DocumentNumberRules.Problem.Length,
            DocumentNumberRules.problemWith("A".repeat(25), IdDocType.Passport)
        )
        assertEquals(
            DocumentNumberRules.Problem.Characters,
            DocumentNumberRules.problemWith("A12/345", IdDocType.Passport)
        )
    }

    @Test
    fun `the canonical number is upper-cased without separators`() {
        assertEquals("A123456", DocumentNumberRules.canonical(" a 123-456 "))
    }

    // ---- AccountIdentity ----------------------------------------------------------------------

    @Test
    fun `absent identity fields read as not required and complete`() {
        val identity = AccountIdentity.from(null, null, null, null)
        assertFalse(identity.required)
        assertTrue(identity.complete)
        assertFalse(identity.needsCompletion)
        assertFalse(identity.rejected)
        assertEquals("unverified", identity.status)
    }

    @Test
    fun `a new Google account that owes its documents is held on Complete your account`() {
        val identity = AccountIdentity.from(true, false, "unverified", null)
        assertTrue(identity.needsCompletion)
        assertFalse(identity.rejected)
    }

    @Test
    fun `an old account is never held, whatever it says about completeness`() {
        assertFalse(AccountIdentity.from(false, false, "unverified", null).needsCompletion)
    }

    @Test
    fun `a pending document blocks nothing`() {
        val identity = AccountIdentity.from(true, true, "pending", null)
        assertFalse(identity.needsCompletion)
        assertFalse(identity.rejected)
    }

    @Test
    fun `a rejected document shows the reason`() {
        val identity = AccountIdentity.from(true, true, "rejected", "  Photo is blurry ")
        assertTrue(identity.rejected)
        assertEquals("Photo is blurry", identity.note)
    }

    @Test
    fun `a note is only kept on a rejection, and a literal null is no note`() {
        assertNull(AccountIdentity.from(true, true, "pending", "stale").note)
        assertNull(AccountIdentity.from(true, true, "rejected", "null").note)
        assertNull(AccountIdentity.from(true, true, "rejected", "").note)
    }

    @Test
    fun `an unknown status reads as unverified`() {
        assertEquals("unverified", AccountIdentity.from(true, true, "weird", null).status)
        assertEquals("verified", AccountIdentity.from(true, true, " VERIFIED ", null).status)
    }

    @Test
    fun `a rejection on an account without the requirement shows no notice`() {
        assertFalse(AccountIdentity.from(false, true, "rejected", "x").rejected)
    }

    // ---- IdentityBlock ------------------------------------------------------------------------

    @Test
    fun `booking refusals are read from the code`() {
        assertEquals(IdentityBlock.Incomplete, IdentityBlock.from("identity_incomplete"))
        assertEquals(IdentityBlock.Rejected, IdentityBlock.from("identity_rejected"))
        assertNull(IdentityBlock.from(null))
        assertNull(IdentityBlock.from("dates_unavailable"))
    }

    // ---- SignupIdentityRules ------------------------------------------------------------------

    @Test
    fun `a complete form has no problems`() {
        assertTrue(
            SignupIdentityRules.problems("01012345678", IdDocType.NationalId, "29801011234567", true, true).isEmpty()
        )
    }

    @Test
    fun `each missing piece is reported under the API's field key`() {
        val problems = SignupIdentityRules.problems("", IdDocType.Passport, "x", false, false)
        assertEquals(SignupIdentityRules.Problem.PhoneMissing, problems["phone"])
        assertEquals(SignupIdentityRules.Problem.IdNumber, problems["id_number"])
        assertEquals(SignupIdentityRules.Problem.FrontMissing, problems["id_front"])
        assertEquals(SignupIdentityRules.Problem.BackMissing, problems["id_back"])
        assertEquals(
            SignupIdentityRules.Problem.PhoneInvalid,
            SignupIdentityRules.problems("123", IdDocType.Passport, "A12345", true, true)["phone"]
        )
    }

    @Test
    fun `a signup-rule account re-uploads without a selfie, an older one keeps it`() {
        assertEquals(false, AccountIdentity(required = true, status = "rejected").selfieRequired)
        assertEquals(true, AccountIdentity(required = false).selfieRequired)
        assertEquals(true, AccountIdentity().selfieRequired)
    }
}
