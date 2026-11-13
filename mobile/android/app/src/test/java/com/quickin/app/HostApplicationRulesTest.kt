package com.quickin.app

import com.quickin.app.HostApplicationRules.ApplicantProfile
import com.quickin.app.HostApplicationRules.FULL_NAME
import com.quickin.app.HostApplicationRules.NATIONAL_ID
import com.quickin.app.HostApplicationRules.PHONE
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [HostApplicationRules] — the become-a-host form on the same account. The Kotlin
 * mirror of the backend's `host-application-core` (profile wins, only `missing` is asked for,
 * payout required unless on file, terms must be explicitly accepted).
 */
class HostApplicationRulesTest {

    private val complete = ApplicantProfile(
        fullName = "Kareem Eladl",
        phone = "+201012345678",
        nationalId = "29801011234567",
        verificationStatus = "verified",
        missing = emptyList()
    )

    private val bank = PayoutDraft(
        method = PayoutMethodKind.BANK_ACCOUNT,
        accountName = "Kareem Eladl",
        bankName = "CIB",
        iban = "EG380019000500000000263180002"
    )

    private fun readiness(
        askedFields: List<String> = emptyList(),
        askedValues: Map<String, String> = emptyMap(),
        nameOk: Boolean = true,
        address: String = "12 Nile St, Cairo",
        idReady: Boolean = true,
        payoutOnFile: Boolean = false,
        draft: PayoutDraft = bank,
        terms: Boolean = true
    ) = HostApplicationRules.Readiness(
        askedValues = askedValues,
        askedFields = askedFields,
        nameOk = nameOk,
        address = address,
        idDocumentsReady = idReady,
        payoutOnFile = payoutOnFile,
        payoutDraft = draft,
        termsAccepted = terms
    )

    // ---- What the form asks for ------------------------------------------------

    @Test
    fun `a complete profile asks for nothing and shows all three read-only`() {
        assertEquals(emptyList<String>(), HostApplicationRules.fieldsToAsk(complete))
        assertEquals(
            listOf(FULL_NAME to "Kareem Eladl", PHONE to "+201012345678", NATIONAL_ID to "29801011234567"),
            HostApplicationRules.onFile(complete)
        )
    }

    @Test
    fun `only the missing fields get an input`() {
        val p = complete.copy(phone = null, missing = listOf(PHONE))
        assertEquals(listOf(PHONE), HostApplicationRules.fieldsToAsk(p))
        assertEquals(listOf(FULL_NAME, NATIONAL_ID), HostApplicationRules.onFile(p).map { it.first })
    }

    @Test
    fun `a field with no value is asked for even if missing forgot it`() {
        val p = complete.copy(nationalId = "  ", missing = emptyList())
        assertEquals(listOf(NATIONAL_ID), HostApplicationRules.fieldsToAsk(p))
    }

    @Test
    fun `an older server without profile asks for all three`() {
        assertEquals(listOf(FULL_NAME, PHONE, NATIONAL_ID), HostApplicationRules.fieldsToAsk(null))
        assertTrue(HostApplicationRules.onFile(null).isEmpty())
    }

    @Test
    fun `missing is normalized, ordered and stripped of unknown names`() {
        assertEquals(
            listOf(FULL_NAME, NATIONAL_ID),
            HostApplicationRules.normalizeMissing(listOf("national_id", " FULL_NAME ", "email", null, "full_name"))
        )
    }

    // ---- Payout ------------------------------------------------------------------

    @Test
    fun `payout is required only when none is on file`() {
        assertTrue(HostApplicationRules.payoutRequired(false))
        assertFalse(HostApplicationRules.payoutRequired(true))
    }

    @Test
    fun `payout is sent when none is on file or the applicant replaces it`() {
        assertTrue(HostApplicationRules.sendPayout(payoutOnFile = false, replacing = false))
        assertFalse(HostApplicationRules.sendPayout(payoutOnFile = true, replacing = false))
        assertTrue(HostApplicationRules.sendPayout(payoutOnFile = true, replacing = true))
    }

    @Test
    fun `a bank draft needs a name, a bank and an IBAN or account number`() {
        assertTrue(HostApplicationRules.payoutDraftComplete(bank))
        assertTrue(HostApplicationRules.payoutDraftComplete(bank.copy(iban = "", accountNumber = "1234567")))
        assertFalse(HostApplicationRules.payoutDraftComplete(bank.copy(iban = "", accountNumber = "")))
        assertFalse(HostApplicationRules.payoutDraftComplete(bank.copy(bankName = " ")))
        assertFalse(HostApplicationRules.payoutDraftComplete(bank.copy(accountName = "K")))
    }

    @Test
    fun `an instapay draft needs a name and an address`() {
        val insta = PayoutDraft(method = PayoutMethodKind.INSTAPAY, accountName = "Kareem", instapayAddress = "kareem@instapay")
        assertTrue(HostApplicationRules.payoutDraftComplete(insta))
        assertFalse(HostApplicationRules.payoutDraftComplete(insta.copy(instapayAddress = "")))
    }

    @Test
    fun `a retired wallet draft is never complete`() {
        assertFalse(HostApplicationRules.payoutDraftComplete(bank.copy(method = PayoutMethodKind.WALLET)))
    }

    // ---- Submit button -----------------------------------------------------------

    @Test
    fun `a complete form can submit`() {
        assertTrue(HostApplicationRules.canSubmit(readiness()))
    }

    @Test
    fun `terms must be accepted`() {
        assertFalse(HostApplicationRules.canSubmit(readiness(terms = false)))
    }

    @Test
    fun `address is required`() {
        assertFalse(HostApplicationRules.canSubmit(readiness(address = "  ")))
    }

    @Test
    fun `an empty payout draft blocks unless one is on file`() {
        val empty = PayoutDraft()
        assertFalse(HostApplicationRules.canSubmit(readiness(draft = empty)))
        assertTrue(HostApplicationRules.canSubmit(readiness(draft = empty, payoutOnFile = true)))
    }

    @Test
    fun `asked profile fields must be filled and a typed name must pass the policy`() {
        val asked = listOf(FULL_NAME, PHONE)
        assertFalse(HostApplicationRules.canSubmit(readiness(askedFields = asked, askedValues = mapOf(FULL_NAME to "Kareem"))))
        assertTrue(
            HostApplicationRules.canSubmit(
                readiness(askedFields = asked, askedValues = mapOf(FULL_NAME to "Kareem", PHONE to "01012345678"))
            )
        )
        assertFalse(
            HostApplicationRules.canSubmit(
                readiness(
                    askedFields = asked,
                    askedValues = mapOf(FULL_NAME to "12345", PHONE to "01012345678"),
                    nameOk = false
                )
            )
        )
    }

    @Test
    fun `a name problem is ignored when the name comes from the profile`() {
        assertTrue(HostApplicationRules.canSubmit(readiness(nameOk = false)))
    }

    @Test
    fun `missing ID documents block`() {
        assertFalse(HostApplicationRules.canSubmit(readiness(idReady = false)))
    }

    @Test
    fun `terms link opens the host agreement on the site`() {
        assertEquals(
            "https://quickin-frontend.vercel.app/terms#host",
            HostApplicationRules.termsUrl("https://quickin-frontend.vercel.app/")
        )
    }
}
