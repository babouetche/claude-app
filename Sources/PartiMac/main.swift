import AppKit

let args = CommandLine.arguments
if let i = args.firstIndex(of: "--selftest") {
    let dir = i + 1 < args.count ? args[i + 1] : NSTemporaryDirectory() + "partimac-selftest"
    exit(SelfTest.run(outputDir: dir))
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
