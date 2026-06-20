import Foundation
import UIKit

/// Decoded response from the OCR backend at `Config.idOcrBaseURL`.
/// The backend proxies StructOCR, so this carries the full extracted ID data.
struct IDScanResult: Decodable {
    let success: Bool
    let idNumber: String?          // 14-digit national ID (StructOCR `personal_number`)
    let fullName: String?          // given names + surname (Arabic)
    let documentNumber: String?    // card document number, e.g. "JA1234567"
    let birthDate: String?
    let birthYear: Int?
    let governorate: String?       // derived from the ID number
    let gender: String?
    let nationality: String?
    let address: String?           // Arabic address
    /// Present when `success == false`.
    let message: String?
    /// All digits the server found (useful for debugging scan failures).
    let rawDigits: String?
    /// Server hint that the auto-scan failed / is out of credits → offer manual upload.
    let needsManual: Bool?

    enum CodingKeys: String, CodingKey {
        case success, message, gender, governorate, nationality, address
        case idNumber        = "id_number"
        case fullName        = "full_name"
        case documentNumber  = "document_number"
        case birthDate       = "birth_date"
        case birthYear       = "birth_year"
        case rawDigits       = "raw_digits"
        case needsManual     = "needs_manual"
    }

    /// Convenience init for error cases (not decoded from JSON).
    init(success: Bool, message: String? = nil) {
        self.success        = success
        self.message        = message
        self.idNumber       = nil
        self.fullName       = nil
        self.documentNumber = nil
        self.birthDate      = nil
        self.birthYear      = nil
        self.governorate    = nil
        self.gender         = nil
        self.nationality    = nil
        self.address        = nil
        self.rawDigits      = nil
        self.needsManual    = nil
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

        var request = URLRequest(url: url, timeoutInterval: 90)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["image": b64])

        let (data, _) = try await URLSession.shared.data(for: request)
        let result = try JSONDecoder().decode(IDScanResult.self, from: data)
        return result
    }
}
