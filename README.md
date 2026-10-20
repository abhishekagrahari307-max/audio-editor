# Audio Editor — Free In-Browser Audio Toolkit

A web build of the mobile "Audio Editor" app. Every tool runs 100% locally in the
browser with the Web Audio API — **no uploads, no server, no sign-in**.

## Tools
| Category | Tools |
|---|---|
| Editing | Trim · **Multi-track Studio** · Merge · Mix · Split · Insert (splice) · Volume Booster · Ringtone Maker |
| Processing | Video to MP3 · MP3 to Video (animated visualizer, WebM) · AI Noise Remover (spectral subtraction) |
| PRO (locked in demo) | Voice Changer · Voice Recorder · Compressor |

## Multi-track Studio features
- Undo/Redo (50 steps, Ctrl+Z / Ctrl+Y), snap to grid & playhead
- Per-track Mute / Solo / Lock
- Drag clips to move, drag edges to trim, split at playhead
- Clip volume (−60…+12 dB), fade in/out (linear or smooth curve)
- Speed (0.5×–2×, tape-style), Reverse, per-clip AI noise clean
- Pinch / button zoom, tap time label to jump, red "!" clipping alert
- Export: WAV (lossless), MP3 160 kbps, MP3 320 kbps (inlined lamejs encoder)

## Run
```bash
python3 -m http.server 8080 --bind 0.0.0.0
# open http://localhost:8080
```
Or just open `index.html` — it is a single self-contained file (no build step, no CDN).

## Rebuild (for contributors)
```bash
./build.sh        # assembles src/*.html + inlined lamejs -> index.html
node qa.js        # end-to-end browser QA (needs Playwright + Chromium)
```

All audio processing stays on the device. Made with vanilla JS — no framework.
