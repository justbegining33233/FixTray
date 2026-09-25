import AVFoundation
import Capacitor
import UIKit

/// Cold-launch logo intro. The website never plays this; it is bundled in the app.
@objc(IntroBridgeViewController)
class IntroBridgeViewController: CAPBridgeViewController {
    private var didStartIntro = false
    private var introView: UIView?
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var endObserver: NSObjectProtocol?
    private var failObserver: NSObjectProtocol?

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didStartIntro else { return }
        didStartIntro = true
        showIntro()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        playerLayer?.frame = introView?.bounds ?? .zero
    }

    private func showIntro() {
        guard let url = Bundle.main.url(forResource: "intro", withExtension: "mp4") else { return }

        let host = UIView(frame: view.bounds)
        host.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.backgroundColor = .white

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspect
        layer.frame = host.bounds
        layer.backgroundColor = UIColor.white.cgColor
        host.layer.insertSublayer(layer, at: 0)

        let mark = UIImageView(image: UIImage(named: "Splash"))
        mark.contentMode = .scaleAspectFit
        mark.backgroundColor = .white
        mark.frame = host.bounds
        mark.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.addSubview(mark)

        host.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dismissIntro)))
        view.addSubview(host)

        introView = host
        self.player = player
        playerLayer = layer
        statusBarStyle = .darkContent
        setNeedsStatusBarAppearanceUpdate()

        watchFirstFrame(layer, mark: mark, attemptsLeft: 160)
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.dismissIntro()
        }
        failObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            self?.dismissIntro()
        }
        if item.status == .failed {
            dismissIntro()
            return
        }
        player.play()
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
            guard let self, self.introView != nil else { return }
            if (self.player?.currentTime().seconds ?? 0) < 0.05 {
                self.dismissIntro()
            }
        }
    }

    private func watchFirstFrame(_ layer: AVPlayerLayer, mark: UIImageView, attemptsLeft: Int) {
        if layer.isReadyForDisplay || attemptsLeft <= 0 {
            if layer.isReadyForDisplay { mark.isHidden = true }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self, weak layer, weak mark] in
            guard self?.introView != nil, let layer, let mark, !mark.isHidden else { return }
            self?.watchFirstFrame(layer, mark: mark, attemptsLeft: attemptsLeft - 1)
        }
    }

    @objc private func dismissIntro() {
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        if let failObserver {
            NotificationCenter.default.removeObserver(failObserver)
            self.failObserver = nil
        }
        player?.pause()
        player = nil
        playerLayer?.removeFromSuperlayer()
        playerLayer = nil
        introView?.removeFromSuperview()
        introView = nil
        statusBarStyle = .lightContent
        setNeedsStatusBarAppearanceUpdate()
    }

    deinit {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        if let failObserver { NotificationCenter.default.removeObserver(failObserver) }
    }
}
