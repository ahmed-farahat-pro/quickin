package com.quickin.app.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the sign-in/sign-up form logic that decides when an inline email hint may speak —
 * in particular that flipping the toggle (which drops `touched`) leaves the form clean, without
 * ever leaving a refused address unexplained under a dead button.
 */
class AuthFormStateTest {

    private val goodPassword = "Aa1!aaaa"

    @Test
    fun `sign-in needs only a password to count as ready`() {
        assertFalse(authOtherFieldsReady(isSignUp = false, name = "", password = "", confirmPassword = ""))
        assertTrue(authOtherFieldsReady(isSignUp = false, name = "", password = "x", confirmPassword = ""))
    }

    @Test
    fun `sign-up needs a real name and a password typed twice`() {
        assertFalse(authOtherFieldsReady(isSignUp = true, name = "12345", password = goodPassword, confirmPassword = goodPassword))
        assertFalse(authOtherFieldsReady(isSignUp = true, name = "Layla Adel", password = "short", confirmPassword = "short"))
        assertFalse(authOtherFieldsReady(isSignUp = true, name = "Layla Adel", password = goodPassword, confirmPassword = "$goodPassword?"))
        assertTrue(authOtherFieldsReady(isSignUp = true, name = "Layla Adel", password = goodPassword, confirmPassword = goodPassword))
    }

    @Test
    fun `an empty address never triggers a hint`() {
        assertFalse(authEmailHintArmed(email = "", touched = true, focused = false, otherFieldsReady = true))
        assertFalse(authEmailHintArmed(email = "   ", touched = true, focused = false, otherFieldsReady = true))
    }

    @Test
    fun `leaving the field arms the hint`() {
        assertFalse(authEmailHintArmed(email = "layla@gmail.con", touched = false, focused = true, otherFieldsReady = false))
        assertTrue(authEmailHintArmed(email = "layla@gmail.con", touched = true, focused = false, otherFieldsReady = false))
    }

    /** The reported bug: switching to Create Account must not carry the sign-in form's hint over. */
    @Test
    fun `a mode switch that drops touched leaves the form quiet`() {
        assertFalse(authEmailHintArmed(email = "layla@gmail.con", touched = false, focused = false, otherFieldsReady = false))
    }

    @Test
    fun `the hint arms itself once the address is the only thing left`() {
        assertTrue(authEmailHintArmed(email = "layla@mailinator.com", touched = false, focused = false, otherFieldsReady = true))
    }

    @Test
    fun `an address still being typed stays quiet even when everything else is ready`() {
        assertFalse(authEmailHintArmed(email = "layla@gma", touched = false, focused = true, otherFieldsReady = true))
    }
}
