package com.quickin.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Kotlin side of the backend's signup-role-core: which steps each role walks, which step
 * owns which server error, and what the role half of the request body looks like.
 */
class SignupRoleRulesTest {

    private val bank = PayoutDraft(
        method = PayoutMethodKind.BANK_ACCOUNT,
        accountName = " Kareem Adel ",
        bankName = "CIB",
        iban = "EG380019000500000000263180002",
        instapayAddress = "leftover@instapay"
    )
    private val instapay = PayoutDraft(
        method = PayoutMethodKind.INSTAPAY,
        accountName = "Kareem Adel",
        bankName = "leftover bank",
        instapayAddress = " kareem@instapay "
    )

    // ---- steps -----------------------------------------------------------------------------

    @Test
    fun stepsMatchTheBackendPerRole() {
        assertEquals(
            listOf(SignupStep.Account, SignupStep.Identity, SignupStep.Refund),
            SignupRoleRules.steps(SignupRole.Guest)
        )
        assertEquals(
            listOf(SignupStep.Account, SignupStep.Identity, SignupStep.Hosting, SignupStep.Payout),
            SignupRoleRules.steps(SignupRole.Host)
        )
    }

    @Test
    fun googleCompletionDropsTheAccountStep() {
        assertEquals(
            listOf(SignupStep.Identity, SignupStep.Refund),
            SignupRoleRules.steps(SignupRole.Guest, includeAccount = false)
        )
        assertEquals(
            listOf(SignupStep.Role, SignupStep.Identity, SignupStep.Hosting, SignupStep.Payout),
            SignupRoleRules.flow(SignupRole.Host, includeAccount = false)
        )
    }

    @Test
    fun roleScreenIsUnnumberedAndStepsCountFromOne() {
        assertNull(SignupRoleRules.stepNumber(SignupStep.Role, SignupRole.Guest))
        assertEquals(1, SignupRoleRules.stepNumber(SignupStep.Account, SignupRole.Guest))
        assertEquals(2, SignupRoleRules.stepNumber(SignupStep.Identity, SignupRole.Guest))
        assertEquals(3, SignupRoleRules.stepNumber(SignupStep.Refund, SignupRole.Guest))
        assertEquals(4, SignupRoleRules.stepNumber(SignupStep.Payout, SignupRole.Host))
        assertEquals(1, SignupRoleRules.stepNumber(SignupStep.Identity, SignupRole.Host, includeAccount = false))
        // A host-only step is not part of the guest flow.
        assertNull(SignupRoleRules.stepNumber(SignupStep.Hosting, SignupRole.Guest))
    }

    @Test
    fun nextAndPreviousWalkTheFlow() {
        assertEquals(SignupStep.Account, SignupRoleRules.next(SignupStep.Role, SignupRole.Guest))
        assertEquals(SignupStep.Identity, SignupRoleRules.next(SignupStep.Role, SignupRole.Guest, includeAccount = false))
        assertEquals(SignupStep.Hosting, SignupRoleRules.next(SignupStep.Identity, SignupRole.Host))
        assertNull(SignupRoleRules.next(SignupStep.Refund, SignupRole.Guest))
        assertNull(SignupRoleRules.next(SignupStep.Payout, SignupRole.Host))
        assertTrue(SignupRoleRules.isLast(SignupStep.Payout, SignupRole.Host))
        assertFalse(SignupRoleRules.isLast(SignupStep.Hosting, SignupRole.Host))

        assertNull(SignupRoleRules.previous(SignupStep.Role, SignupRole.Host))
        assertEquals(SignupStep.Role, SignupRoleRules.previous(SignupStep.Account, SignupRole.Host))
        assertEquals(SignupStep.Role, SignupRoleRules.previous(SignupStep.Identity, SignupRole.Host, includeAccount = false))
        assertEquals(SignupStep.Hosting, SignupRoleRules.previous(SignupStep.Payout, SignupRole.Host))
    }

    @Test
    fun onlyRefundIsSkippable() {
        SignupStep.entries.forEach {
            assertEquals(it == SignupStep.Refund, SignupRoleRules.isSkippable(it))
        }
    }

    @Test
    fun roleParsesLikeTheBackend() {
        assertEquals(SignupRole.Host, SignupRole.from(" HOST "))
        assertEquals(SignupRole.Guest, SignupRole.from(null))
        assertEquals(SignupRole.Guest, SignupRole.from("admin"))
    }

    // ---- error routing ---------------------------------------------------------------------

    @Test
    fun everyServerKeyHasAnOwningStep() {
        mapOf(
            "email" to SignupStep.Account, "password" to SignupStep.Account, "full_name" to SignupStep.Account,
            "phone" to SignupStep.Identity, "doc_type" to SignupStep.Identity, "id_number" to SignupStep.Identity,
            "id_front" to SignupStep.Identity, "id_back" to SignupStep.Identity,
            "host_type" to SignupStep.Hosting, "address" to SignupStep.Hosting, "company" to SignupStep.Hosting,
            "notes" to SignupStep.Hosting, "terms" to SignupStep.Hosting,
            "payout" to SignupStep.Payout, "refund_method" to SignupStep.Refund
        ).forEach { (key, step) -> assertEquals(key, step, SignupRoleRules.stepFor(key)) }
        assertNull(SignupRoleRules.stepFor("something_new"))
    }

    @Test
    fun jumpsToTheEarliestStepWithAnError() {
        assertEquals(
            SignupStep.Identity,
            SignupRoleRules.firstStepWithError(listOf("payout", "address", "id_back"), SignupRole.Host)
        )
        assertEquals(
            SignupStep.Hosting,
            SignupRoleRules.firstStepWithError(listOf("payout", "terms"), SignupRole.Host)
        )
        assertEquals(
            SignupStep.Payout,
            SignupRoleRules.firstStepWithError(listOf("payout"), SignupRole.Host)
        )
        assertEquals(
            SignupStep.Refund,
            SignupRoleRules.firstStepWithError(listOf("refund_method"), SignupRole.Guest)
        )
        assertEquals(
            SignupStep.Account,
            SignupRoleRules.firstStepWithError(listOf("phone", "email"), SignupRole.Guest)
        )
    }

    @Test
    fun errorsForPagesOutsideTheFlowAreIgnored() {
        // The completion screen has no Account page; a guest has no Hosting page.
        assertNull(SignupRoleRules.firstStepWithError(listOf("email"), SignupRole.Guest, includeAccount = false))
        assertNull(SignupRoleRules.firstStepWithError(listOf("address"), SignupRole.Guest))
        assertNull(SignupRoleRules.firstStepWithError(emptyList(), SignupRole.Host))
        assertEquals(
            SignupStep.Identity,
            SignupRoleRules.firstStepWithError(listOf("address", "id_number"), SignupRole.Guest)
        )
    }

    @Test
    fun accountRefusalsWithoutFieldsMapToAnAccountKey() {
        assertEquals("email", SignupRoleRules.accountFieldFor(409, null))
        assertEquals("email", SignupRoleRules.accountFieldFor(400, "emailProblem"))
        assertEquals("password", SignupRoleRules.accountFieldFor(400, "passwordProblem"))
        assertEquals("full_name", SignupRoleRules.accountFieldFor(400, "nameProblem"))
        assertEquals("email", SignupRoleRules.accountFieldFor(400, null))
        assertNull(SignupRoleRules.accountFieldFor(500, null))
    }

    // ---- local validation ------------------------------------------------------------------

    @Test
    fun hostingNeedsAnAddressAndTheTerms() {
        val problems = SignupRoleRules.hostingProblems(HostingDetailsDraft(address = "   "))
        assertEquals(
            mapOf(
                "address" to SignupRoleRules.HostingProblem.AddressMissing,
                "terms" to SignupRoleRules.HostingProblem.TermsNotAccepted
            ),
            problems
        )
        assertTrue(
            SignupRoleRules.hostingProblems(HostingDetailsDraft(address = "Gouna, Red Sea", termsAccepted = true)).isEmpty()
        )
    }

    @Test
    fun hostingLengthLimitsMatchTheBackend() {
        val long = HostingDetailsDraft(
            hostType = HostType.Company,
            address = "a".repeat(301),
            company = "c".repeat(121),
            notes = "n".repeat(1001),
            termsAccepted = true
        )
        assertEquals(
            setOf("address", "company", "notes"),
            SignupRoleRules.hostingProblems(long).keys
        )
        // At the limit is fine; whitespace runs collapse before measuring, as on the server.
        val atLimit = long.copy(address = "a".repeat(300), company = "c".repeat(60) + "     " + "c".repeat(59), notes = "n".repeat(1000))
        assertTrue(SignupRoleRules.hostingProblems(atLimit).isEmpty())
        // An individual's company is neither shown nor checked.
        assertTrue(SignupRoleRules.hostingProblems(long.copy(hostType = HostType.Individual, address = "x", notes = "")).isEmpty())
    }

    @Test
    fun destinationCompleteness() {
        assertTrue(SignupRoleRules.destinationComplete(bank))
        assertTrue(SignupRoleRules.destinationComplete(bank.copy(iban = "", accountNumber = "100012345")))
        assertFalse(SignupRoleRules.destinationComplete(bank.copy(iban = "", accountNumber = "")))
        assertFalse(SignupRoleRules.destinationComplete(bank.copy(bankName = "")))
        assertFalse(SignupRoleRules.destinationComplete(bank.copy(accountName = "K")))
        assertTrue(SignupRoleRules.destinationComplete(instapay))
        assertFalse(SignupRoleRules.destinationComplete(instapay.copy(instapayAddress = " ")))
        assertFalse(SignupRoleRules.destinationComplete(bank.copy(method = PayoutMethodKind.WALLET)))
    }

    @Test
    fun aBlankDestinationIsUntouched() {
        assertFalse(SignupRoleRules.destinationTouched(PayoutDraft()))
        assertFalse(SignupRoleRules.destinationTouched(PayoutDraft(method = PayoutMethodKind.INSTAPAY)))
        assertTrue(SignupRoleRules.destinationTouched(PayoutDraft(accountName = "K")))
    }

    // ---- body ------------------------------------------------------------------------------

    @Test
    fun bankBodySendsOnlyBankFieldsAndOptionalOnesWhenTyped() {
        assertEquals(
            mapOf(
                "method" to "bank_account",
                "account_name" to "Kareem Adel",
                "bank_name" to "CIB",
                "iban" to "EG380019000500000000263180002"
            ),
            SignupRoleRules.destinationBody(bank)
        )
        val full = SignupRoleRules.destinationBody(bank.copy(accountNumber = "1000", swiftBic = "CIBEEGCX", branch = "Zamalek"))
        assertEquals("1000", full["account_number"])
        assertEquals("CIBEEGCX", full["swift_bic"])
        assertEquals("Zamalek", full["branch"])
    }

    @Test
    fun instapayBodySendsOnlyTheAddress() {
        assertEquals(
            mapOf("method" to "instapay", "account_name" to "Kareem Adel", "instapay_address" to "kareem@instapay"),
            SignupRoleRules.destinationBody(instapay)
        )
    }

    @Test
    fun guestBodyOmitsASkippedRefund() {
        assertEquals(mapOf("role" to "guest"), SignupRoleRules.roleBody(SignupRole.Guest, null, null, null))
        val withRefund = SignupRoleRules.roleBody(SignupRole.Guest, HostingDetailsDraft(address = "ignored"), instapay, bank)
        assertEquals(setOf("role", "refund_method"), withRefund.keys)
        assertEquals(SignupRoleRules.destinationBody(instapay), withRefund["refund_method"])
    }

    @Test
    fun hostBodyCarriesHostingTermsAndPayout() {
        val body = SignupRoleRules.roleBody(
            SignupRole.Host,
            HostingDetailsDraft(
                hostType = HostType.Brokerage,
                address = "  12   Nile St,  Cairo ",
                company = " Acme  Homes ",
                notes = "  Line one\nline two  ",
                termsAccepted = true
            ),
            refund = instapay,
            payout = bank
        )
        assertEquals(
            mapOf(
                "role" to "host",
                "host_type" to "brokerage",
                "address" to "12 Nile St, Cairo",
                "company" to "Acme Homes",
                "notes" to "Line one\nline two",
                "terms_accepted" to true,
                "payout" to SignupRoleRules.destinationBody(bank)
            ),
            body
        )
    }

    @Test
    fun individualHostNeverSendsCompanyAndBlankNotesAreOmitted() {
        val body = SignupRoleRules.roleBody(
            SignupRole.Host,
            HostingDetailsDraft(hostType = HostType.Individual, address = "Gouna", company = "Typed before switching", termsAccepted = true),
            refund = null,
            payout = instapay
        )
        assertFalse(body.containsKey("company"))
        assertFalse(body.containsKey("notes"))
        assertFalse(body.containsKey("refund_method"))
        assertEquals("individual", body["host_type"])
    }
}
