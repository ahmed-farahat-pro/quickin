// /account/delete — un-prefixed alias of the account-deletion page, so both
// /account/delete and the locale-prefixed /:locale/account/delete resolve to the
// same public deletion flow. See ../[locale]/account/delete and /delete-account.
export { default } from '../../delete-account/page'
