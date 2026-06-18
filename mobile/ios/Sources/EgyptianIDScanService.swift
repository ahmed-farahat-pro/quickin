import Foundation
import UIKit

/// Decoded response from the local OCR server at `Config.idOcrBaseURL`.
struct IDScanResult: Decodable {
    let success: Bool
    let idNumber: String?
    let birthDate: String?
    let birthYear: Int?
    let governorate: String?
    let gender: String?
    /// Present when `success == false`.
    let message: String?

    enum CodingKeys: String, CodingKey {
        case success, message, gender, governorate
        case idNumber   = "id_number"
        case birthDate  = "birth_date"
        case birthYear  = "birth_year"
    }
}

/// Sends a JPEG image to the local Python OCR server and decodes the result.
///
/// The server must be running at `Config.idOcrBaseURL` (defaults to
/// `http://localhost:8000` for Simulator / local development).
enum EgyptianIDScanService {

    enum ScanError: LocalizedError {
        case imageEncodingFailed
        case serverError(String)

        var errorDescription: String? {
            switch self {
            case .imageEncodingFailed:
                return "Could not encode the image. Please try again."
            case .serverError(let msg):
                return msg
            }
        }
    }

    /// Compress `image` to JPEG, base-64 encode it, POST to `/scan-base64`,
    /// and return the decoded `IDScanResult`.
    static func scan(image: UIImage) async throws -> IDScanResult {
        guard let jpeg = image.jpegData(compressionQuality: 0.85) else {
            throw ScanError.imageEncodingFailed
        }
        let b64 = jpeg.base64EncodedString()
        let endpoint = Config.idOcrBaseURL + "/scan-base64"
        guard let url = URL(string: endpoint) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["image": b64])

        let (data, _) = try await URLSession.shared.data(for: request)
        let result = try JSONDecoder().decode(IDScanResult.self, from: data)
        return result
    }
}
