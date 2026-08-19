import Photos
import PhotosUI
import SwiftUI
import UIKit

/// Turning a `PhotosPickerItem` into a `UIImage`, reliably.
///
/// `item.loadTransferable(type: Data.self)` is the obvious way to do this and the
/// way every picker in the app used to do it, but it is not dependable. It throws
/// `CoreTransferable.TransferableSupportError` — an error with no `localizedDescription`
/// of its own, so it renders as the useless "The operation couldn't be completed.
/// (CoreTransferable.TransferableSupportError error 0.)" — whenever the chosen asset
/// has no ready data representation to hand over. In practice that means:
///
///   * the photo lives in iCloud and the local copy is a thumbnail (Optimise iPhone
///     Storage), so the bytes have to be fetched over the network first;
///   * it came from a Shared Album or a Shared Library, which have no local original;
///   * it is a Live Photo, RAW/ProRAW or some other multi-representation asset whose
///     primary type isn't a plain image blob.
///
/// None of those are the user's fault and none of them are unrecoverable, so this
/// helper does not stop at the first failure. It falls back to the Photos framework,
/// which — unlike the Transferable path — can be told `isNetworkAccessAllowed = true`
/// and will download the original from iCloud and flatten whatever it finds into a
/// single image. That fallback needs the asset's local identifier, which is only
/// populated when the picker is created with `photoLibrary: .shared()`; the ID
/// screens already do that, and the usage descriptions are declared in `project.yml`.
///
/// Callers get back a typed failure rather than a system `Error`, so what reaches the
/// user is a sentence they can act on instead of a framework symbol name.
enum QKPhotoPickerLoader {

    /// Why a picked photo could not be turned into an image.
    enum LoadFailure: Error {
        /// The asset is in iCloud and could not be downloaded — almost always
        /// connectivity. Retrying, or using the camera, works.
        case needsDownload
        /// The bytes arrived but nothing could be decoded from them.
        case unreadable

        /// The localization key for the message to show the user.
        var messageKey: String {
            switch self {
            case .needsDownload: return "trust.photoDownloadError"
            case .unreadable:    return "trust.uploadError"
            }
        }
    }

    /// Load `item` as a `UIImage`, trying the cheap path first and falling back to
    /// an iCloud-aware Photos fetch. Never throws; the failure case carries the
    /// reason so the caller can show the right message.
    ///
    /// Deliberately `nonisolated` and `async`: callers are `@MainActor` view models,
    /// and a non-isolated async function runs on the cooperative pool rather than
    /// inheriting the main actor, so decoding a large photo doesn't stall the UI.
    static func loadImage(from item: PhotosPickerItem) async -> Result<UIImage, LoadFailure> {
        // 1. The fast path. Works for the great majority of photos.
        if let data = try? await item.loadTransferable(type: Data.self),
           let image = UIImage(data: data) {
            return .success(image)
        }

        // 2. The fallback. Needs the local identifier, which the picker only
        //    supplies when it was built with `photoLibrary: .shared()`.
        guard let identifier = item.itemIdentifier, await ensureLibraryAccess() else {
            return .failure(.unreadable)
        }
        guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil).firstObject else {
            return .failure(.unreadable)
        }

        let fetched = await requestImageData(for: asset)
        if let image = fetched.image { return .success(image) }

        // 3. Last resort: let Photos render the asset for us. This is what rescues
        //    Live Photos and RAW, whose data representation we may not be able to
        //    decode even once we have it.
        if let rendered = await requestRenderedImage(for: asset) { return .success(rendered) }

        return .failure(fetched.wasInCloud ? .needsDownload : .unreadable)
    }

    // MARK: - Photos framework fallbacks

    /// The picker itself already prompts for access when built with `.shared()`, so
    /// in practice this returns immediately. It asks only when the status is still
    /// undetermined, and never re-prompts a user who has said no.
    private static func ensureLibraryAccess() async -> Bool {
        switch PHPhotoLibrary.authorizationStatus(for: .readWrite) {
        case .authorized, .limited:
            return true
        case .notDetermined:
            let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
            return status == .authorized || status == .limited
        default:
            return false
        }
    }

    /// Ask Photos for the asset's original bytes, downloading from iCloud if that is
    /// where they are. `wasInCloud` distinguishes "we couldn't reach iCloud" (worth
    /// retrying) from "this file is broken" (not worth retrying).
    private static func requestImageData(for asset: PHAsset) async -> (image: UIImage?, wasInCloud: Bool) {
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .none
        options.version = .current

        return await withCheckedContinuation { continuation in
            var resumed = false
            PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) { data, _, _, info in
                // `.highQualityFormat` delivers once, but the handler is documented as
                // callable more than once; resuming a continuation twice is a crash.
                guard !resumed else { return }
                resumed = true
                continuation.resume(returning: (data.flatMap(UIImage.init(data:)), isDownloadFailure(info)))
            }
        }
    }

    /// Whether a failed Photos request failed because the original is in iCloud and
    /// couldn't be fetched, as opposed to the file being unusable. `PHImageResultIsInCloudKey`
    /// only appears when network access was disallowed, so with downloads enabled the
    /// signal is the transport error instead.
    private static func isDownloadFailure(_ info: [AnyHashable: Any]?) -> Bool {
        if (info?[PHImageResultIsInCloudKey] as? Bool) == true { return true }
        guard let error = info?[PHImageErrorKey] as? NSError else { return false }
        return error.domain == NSURLErrorDomain || error.domain == "CloudPhotoLibraryErrorDomain"
    }

    /// Have Photos decode and flatten the asset itself. Capped at 2048pt because the
    /// callers immediately downscale to 1280 anyway, and asking for the full original
    /// of a 48MP photo just to shrink it wastes memory.
    private static func requestRenderedImage(for asset: PHAsset) async -> UIImage? {
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        options.resizeMode = .exact

        return await withCheckedContinuation { continuation in
            var resumed = false
            PHImageManager.default().requestImage(
                for: asset,
                targetSize: CGSize(width: 2048, height: 2048),
                contentMode: .aspectFit,
                options: options
            ) { image, _ in
                // `.highQualityFormat` is documented to deliver exactly once, but the
                // handler may legally fire again; resume on the first result only.
                // Never wait for a "better" one — a second call that never comes
                // would leave this continuation suspended forever.
                guard !resumed else { return }
                resumed = true
                continuation.resume(returning: image)
            }
        }
    }
}
