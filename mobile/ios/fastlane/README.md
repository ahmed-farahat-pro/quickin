fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios bootstrap_signing

```sh
[bundle exec] fastlane ios bootstrap_signing
```

One-time bootstrap: seed this app's App Store profile into the shared

match repo. Run from a Mac with the same env vars CI uses. Needs an

Admin / App Manager API key — it writes to the portal and the repo.

### ios list_certs

```sh
[bundle exec] fastlane ios list_certs
```

Diagnostic: list the certificates this API key can see on the portal.

Tells a revoked certificate apart from a key pointed at another team.

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build QuickIn and upload it to TestFlight

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
