import SwiftUI
import AVFoundation
import PhotosUI
import UIKit

// MARK: - Live camera preview

private final class PreviewUIView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> PreviewUIView {
        let v = PreviewUIView()
        v.previewLayer.session = session
        v.previewLayer.videoGravity = .resizeAspectFill
        return v
    }
    func updateUIView(_ view: PreviewUIView, context: Context) {}
}

// MARK: - Frame sampler (throttles to 1 frame every 1.5 s)

private final class FrameSampler: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    var onSample: ((UIImage) -> Void)?
    private var lastAt: Date = .distantPast
    private let gap: TimeInterval = 1.5

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        let now = Date()
        guard now.timeIntervalSince(lastAt) >= gap else { return }
        lastAt = now
        guard let pxBuf = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ci = CIImage(cvPixelBuffer: pxBuf)
        guard let cg = CIContext().createCGImage(ci, from: ci.extent) else { return }
        // Camera frames arrive rotated 90° in portrait — .right corrects it.
        onSample?(UIImage(cgImage: cg, scale: 1, orientation: .right))
    }
}

// MARK: - EgyptianIDScanView

struct EgyptianIDScanView: View {
    var onIDDetected: (String) -> Void

    private let burgundy = Color(red: 91/255, green: 15/255, blue: 22/255)
    private let ink      = Color(red: 26/255, green: 18/255, blue: 11/255)

    @State private var session   = AVCaptureSession()
    @State private var sampler   = FrameSampler()
    @State private var started   = false
    @State private var loading   = false
    @State private var result: IDScanResult?
    @State private var status    = "Align your ID card inside the frame"
    @State private var attempts  = 0
    // Simulator-only photo picker
    @State private var pickerItem: PhotosPickerItem?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        #if targetEnvironment(simulator)
        simulatorBody
        #else
        cameraBody
        #endif
    }

    // MARK: - Simulator body (photo picker → OCR)

    private var simulatorBody: some View {
        NavigationStack {
            ZStack {
                Color(red: 246/255, green: 241/255, blue: 230/255).ignoresSafeArea()
                VStack(spacing: 24) {
                    Spacer()
                    Image(systemName: "creditcard.viewfinder")
                        .font(.system(size: 64, weight: .light))
                        .foregroundStyle(burgundy.opacity(0.5))
                    Text("Simulator: no camera")
                        .font(.headline)
                        .foregroundStyle(burgundy)
                    Text("Pick a photo of your Egyptian National ID card.")
                        .font(.footnote).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center).padding(.horizontal, 40)

                    if loading {
                        ProgressView("Scanning with EasyOCR…").tint(burgundy)
                    } else if let r = result {
                        if r.success {
                            VStack(spacing: 10) {
                                Label("ID Detected", systemImage: "checkmark.seal.fill")
                                    .foregroundStyle(.green).font(.headline)
                                if let id = r.idNumber {
                                    Text(id)
                                        .font(.system(size: 22, weight: .heavy, design: .monospaced))
                                        .tracking(2)
                                }
                                HStack(spacing: 16) {
                                    if let bd = r.birthDate { Label(bd, systemImage: "calendar").font(.caption) }
                                    if let gov = r.governorate { Label(gov, systemImage: "mappin.circle").font(.caption) }
                                }
                                Button {
                                    if let id = r.idNumber { onIDDetected(id) }
                                    dismiss()
                                } label: {
                                    Text("Use this ID")
                                        .font(.system(size: 16, weight: .bold))
                                        .frame(maxWidth: .infinity).frame(height: 50)
                                        .foregroundStyle(.white).background(Color.green)
                                        .clipShape(RoundedRectangle(cornerRadius: 20))
                                }
                                .buttonStyle(QKPressStyle())
                            }
                            .padding(20)
                            .background(Color(red: 236/255, green: 253/255, blue: 245/255))
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                            .padding(.horizontal, 24)
                        } else {
                            VStack(spacing: 6) {
                            Text(r.message ?? "Could not read the ID")
                                .foregroundStyle(.red).font(.footnote)
                                .multilineTextAlignment(.center)
                            if let digits = r.rawDigits, !digits.isEmpty {
                                Text("Digits found: \(digits)")
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                            }
                        }
                        .padding(.horizontal, 24)
                        }
                    }

                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("Choose Photo of ID", systemImage: "photo.on.rectangle.angled")
                            .font(.system(size: 16, weight: .semibold))
                            .frame(maxWidth: .infinity).frame(height: 50)
                            .foregroundStyle(.white).background(burgundy)
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                    }
                    .padding(.horizontal, 24)
                    .disabled(loading)

                    Spacer()
                }
            }
            .navigationTitle("Scan National ID")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(burgundy)
                }
            }
            .onChange(of: pickerItem) { _, item in
                Task { await loadPickedPhoto(item) }
            }
        }
    }

    private func loadPickedPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        result = nil
        guard let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        loading = true
        do {
            let r = try await EgyptianIDScanService.scan(image: image)
            await MainActor.run { result = r; loading = false }
        } catch {
            await MainActor.run {
                result = IDScanResult(success: false, message: error.localizedDescription)
                loading = false
            }
        }
    }

    // MARK: - Camera body (real device)

    private var cameraBody: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            CameraPreview(session: session).ignoresSafeArea()

            GeometryReader { geo in
                let w = geo.size.width
                let h = geo.size.height
                let cw: CGFloat = w - 40
                let ch: CGFloat = cw / (85.6 / 53.98)
                let cx: CGFloat = 20
                let cy: CGFloat = (h - ch) / 2

                dimSurround(w: w, h: h, cx: cx, cy: cy, cw: cw, ch: ch)
                cardFrame(cx: cx, cy: cy, cw: cw, ch: ch)
                cornerMarks(cx: cx, cy: cy, cw: cw, ch: ch)
            }

            VStack {
                topBar
                Spacer()
                bottomPanel.padding(.bottom, 44)
            }
        }
        .ignoresSafeArea()
        .onAppear(perform: startCamera)
        .onDisappear { session.stopRunning() }
    }   // end cameraBody

    // MARK: - Overlay

    private func dimSurround(w: CGFloat, h: CGFloat, cx: CGFloat, cy: CGFloat, cw: CGFloat, ch: CGFloat) -> some View {
        let dim = Color.black.opacity(0.55)
        return ZStack {
            dim.frame(width: w, height: cy)
                .position(x: w/2, y: cy/2)
            dim.frame(width: w, height: h - cy - ch)
                .position(x: w/2, y: cy + ch + (h - cy - ch)/2)
            dim.frame(width: cx, height: ch)
                .position(x: cx/2, y: cy + ch/2)
            dim.frame(width: cx, height: ch)
                .position(x: cx + cw + cx/2, y: cy + ch/2)
        }
    }

    private func cardFrame(cx: CGFloat, cy: CGFloat, cw: CGFloat, ch: CGFloat) -> some View {
        let detected = result?.success == true
        return RoundedRectangle(cornerRadius: 14, style: .continuous)
            .strokeBorder(detected ? Color.green : Color.white,
                          lineWidth: detected ? 3.5 : 2)
            .frame(width: cw, height: ch)
            .position(x: cx + cw/2, y: cy + ch/2)
            .animation(.easeInOut(duration: 0.2), value: detected)
    }

    private func cornerMarks(cx: CGFloat, cy: CGFloat, cw: CGFloat, ch: CGFloat) -> some View {
        let detected = result?.success == true
        let color = detected ? Color.green : Color.white
        let L: CGFloat = 24
        return Path { p in
            // Top-left
            p.move(to: CGPoint(x: cx,      y: cy + L)); p.addLine(to: CGPoint(x: cx, y: cy))
            p.addLine(to: CGPoint(x: cx + L, y: cy))
            // Top-right
            p.move(to: CGPoint(x: cx+cw-L, y: cy));    p.addLine(to: CGPoint(x: cx+cw, y: cy))
            p.addLine(to: CGPoint(x: cx+cw,  y: cy+L))
            // Bottom-right
            p.move(to: CGPoint(x: cx+cw,   y: cy+ch-L)); p.addLine(to: CGPoint(x: cx+cw, y: cy+ch))
            p.addLine(to: CGPoint(x: cx+cw-L, y: cy+ch))
            // Bottom-left
            p.move(to: CGPoint(x: cx+L,    y: cy+ch)); p.addLine(to: CGPoint(x: cx, y: cy+ch))
            p.addLine(to: CGPoint(x: cx,    y: cy+ch-L))
        }
        .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round))
        .animation(.easeInOut(duration: 0.2), value: detected)
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(8)
            }
            Spacer()
            Text("Scan National ID")
                .font(.headline)
                .foregroundStyle(.white)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, 12)
        .padding(.top, 56)
    }

    // MARK: - Bottom panel

    private var bottomPanel: some View {
        Group {
            if let r = result, r.success {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.title3)
                        Text("ID Detected!").font(.headline).foregroundStyle(.white)
                    }
                    if let id = r.idNumber {
                        Text(id)
                            .font(.system(size: 22, weight: .heavy, design: .monospaced))
                            .foregroundStyle(.white)
                            .tracking(2)
                    }
                    HStack(spacing: 18) {
                        if let bd = r.birthDate {
                            Label(bd, systemImage: "calendar")
                                .font(.caption.weight(.medium)).foregroundStyle(.white.opacity(0.8))
                        }
                        if let gov = r.governorate {
                            Label(gov, systemImage: "mappin.circle")
                                .font(.caption.weight(.medium)).foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    Button {
                        if let id = r.idNumber { onIDDetected(id) }
                        dismiss()
                    } label: {
                        Text("Use this ID")
                            .font(.system(size: 16, weight: .bold))
                            .frame(maxWidth: .infinity).frame(height: 50)
                            .foregroundStyle(.white).background(Color.green)
                            .clipShape(RoundedRectangle(cornerRadius: 20))
                    }
                    .buttonStyle(QKPressStyle())
                    .padding(.top, 4)
                }
                .padding(20)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .padding(.horizontal, 16)
            } else {
                HStack(spacing: 10) {
                    if loading {
                        ProgressView().tint(.white).scaleEffect(0.85)
                    } else {
                        Image(systemName: "creditcard.viewfinder").foregroundStyle(.white.opacity(0.75))
                    }
                    Text(loading ? "Reading ID…" : status)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal, 40)
            }
        }
    }

    // MARK: - Camera setup

    private func startCamera() {
        guard !started else { return }
        started = true

        sampler.onSample = { img in Task { @MainActor in await handle(img) } }

        DispatchQueue.global(qos: .userInitiated).async {
            session.beginConfiguration()
            session.sessionPreset = .hd1280x720

            guard
                let dev = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                let inp = try? AVCaptureDeviceInput(device: dev),
                session.canAddInput(inp)
            else { return }
            session.addInput(inp)

            try? dev.lockForConfiguration()
            if dev.isFocusModeSupported(.continuousAutoFocus) { dev.focusMode = .continuousAutoFocus }
            dev.unlockForConfiguration()

            let out = AVCaptureVideoDataOutput()
            out.setSampleBufferDelegate(sampler, queue: DispatchQueue(label: "qk.id.frames"))
            out.alwaysDiscardsLateVideoFrames = true
            if session.canAddOutput(out) { session.addOutput(out) }

            session.commitConfiguration()
            session.startRunning()
        }
    }

    // MARK: - Frame handler

    @MainActor
    private func handle(_ image: UIImage) async {
        guard !loading, result?.success != true else { return }
        loading = true
        attempts += 1
        do {
            let r = try await EgyptianIDScanService.scan(image: image)
            if r.success {
                result = r
                session.stopRunning()
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } else {
                status = attempts > 2
                    ? "Hold still — keep the full card in frame"
                    : "Align your ID card inside the frame"
            }
        } catch {
            status = "Server unreachable — retrying…"
        }
        loading = false
    }
}
