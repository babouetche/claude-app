import AVFoundation
import AudioToolbox
import PartiCore

/// Lecture audio : AVAudioEngine + un échantillonneur SoundFont par partie.
final class Player {
    static let shared = Player()

    private let engine = AVAudioEngine()
    private var samplers: [AVAudioUnitSampler] = []
    private var loadedPrograms: [Int] = []
    private var sequencer: AVAudioSequencer?
    private var timer: Timer?
    private var endBeat: Double = 0
    private(set) var isPlaying = false

    /// Appelé ~30 fois par seconde avec la position en noires (nil à l'arrêt).
    var onPosition: ((Double?) -> Void)?
    var lastError: String?

    /// Banque de sons : SoundFont embarqué, sinon banque General MIDI intégrée à macOS.
    static var soundBankURL: URL? {
        if let u = Bundle.main.url(forResource: "GeneralUser-GS", withExtension: "sf2", subdirectory: "SoundFonts") { return u }
        if let u = Bundle.main.url(forResource: "GeneralUser-GS", withExtension: "sf2") { return u }
        let system = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")
        return FileManager.default.fileExists(atPath: system.path) ? system : nil
    }

    private func prepare(_ score: Score) throws {
        while samplers.count < score.parts.count {
            let s = AVAudioUnitSampler()
            engine.attach(s)
            engine.connect(s, to: engine.mainMixerNode, format: nil)
            samplers.append(s)
            loadedPrograms.append(-1)
        }
        for (i, part) in score.parts.enumerated() {
            let s = samplers[i]
            if loadedPrograms[i] != part.program, let url = Player.soundBankURL {
                try s.loadSoundBankInstrument(at: url, program: UInt8(max(0, min(127, part.program))),
                                              bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
                                              bankLSB: UInt8(kAUSampler_DefaultBankLSB))
                loadedPrograms[i] = part.program
            }
            s.volume = Float(part.volume)
            s.pan = Float(part.pan)
        }
        if !engine.isRunning {
            engine.prepare()
            try engine.start()
        }
    }

    /// Fait entendre brièvement une note ou un accord (pendant la saisie).
    func preview(_ pitches: [Pitch], part: Int, score: Score) {
        guard !isPlaying, !pitches.isEmpty else { return }
        do { try prepare(score) } catch { lastError = error.localizedDescription; return }
        guard part < samplers.count else { return }
        let s = samplers[part]
        let keys = pitches.map { UInt8(max(0, min(127, $0.midi))) }
        for k in keys { s.startNote(k, withVelocity: 90, onChannel: 0) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            for k in keys { s.stopNote(k, onChannel: 0) }
        }
    }

    func play(_ score: Score, fromBeat: Double) throws {
        stop()
        try prepare(score)
        let seq = AVAudioSequencer(audioEngine: engine)
        try seq.load(from: MIDIExporter.data(for: score), options: [])
        let refs = score.staffRefs
        for (i, track) in seq.tracks.enumerated() where i < refs.count {
            track.destinationAudioUnit = samplers[refs[i].part]
        }
        endBeat = score.measureStartBeats.last ?? 0
        seq.currentPositionInBeats = max(0, fromBeat)
        seq.prepareToPlay()
        try seq.start()
        sequencer = seq
        isPlaying = true
        timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            guard let self, let seq = self.sequencer else { return }
            let beat = seq.currentPositionInBeats
            if beat >= self.endBeat + 0.05 || !seq.isPlaying { self.stop(); return }
            self.onPosition?(beat)
        }
    }

    func stop() {
        timer?.invalidate(); timer = nil
        sequencer?.stop()
        sequencer = nil
        for (i, s) in samplers.enumerated() {
            let ch = UInt8(MIDIExporter.channel(forPart: i))
            for k in 0..<128 { s.stopNote(UInt8(k), onChannel: ch); s.stopNote(UInt8(k), onChannel: 0) }
        }
        if isPlaying { isPlaying = false; onPosition?(nil) }
    }
}
