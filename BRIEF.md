# XDJ-RR Web DJ Controller

Build a browser-based replica of the Pioneer XDJ-RR DJ controller. Single HTML file (index.html) with inline CSS/JS. Must work in Chrome on a laptop screen.

## Core Features

### Dual Decks (Left = Deck 1, Right = Deck 2)
- Each deck plays an audio file using Web Audio API
- Waveform display (scrolling, colored by frequency)
- Play/Pause, Cue buttons
- Tempo slider (pitch fader) with BPM display
- Spinning jog wheel that rotates when playing, can be "scratched" by dragging
- Track info display (title, artist parsed from filename)
- Time elapsed / remaining

### Mixer Section (Center)
- Crossfader (horizontal slider)
- Per-channel volume faders (vertical)
- EQ per channel: Hi, Mid, Lo knobs
- Color FX filter knob per channel (sweepable filter — low pass on one side, high pass on other)
- Noise/filter effect — when color filter is engaged, add noise texture option
- Beat FX section with at least: Echo, Reverb, Delay

### Track Browser
- List of 50 most recent tracks from ~/Music/DJ/
- Scrollable list, click to load into Deck 1 or Deck 2 (or drag)
- Show track name parsed from filename (strip file extensions, brackets, "Official Video", etc)

### Visual Design
- Dark theme matching Pioneer XDJ-RR aesthetic (dark gray/black with blue/orange accents)
- Jog wheels should visually spin (CSS animation)
- LED-style indicators
- Waveform colors: blue for deck 1, orange for deck 2
- Professional DJ equipment look and feel

### Beat Matching
- Auto BPM detection (use Web Audio API beat detection or onset detection)
- Sync button per deck (matches BPM to other deck)
- Visual beat grid on waveform

## Audio Backend
- Use Web Audio API (AudioContext, AudioBufferSourceNode, BiquadFilterNode, etc.)
- Files served from a local Express server (simple static file server)
- The server should scan ~/Music/DJ/ for the 50 most recent files and serve them

## Tech Stack
- Single index.html for the frontend (inline everything)
- server.js — simple Express/Node server that:
  - Serves index.html
  - Has GET /api/tracks → returns list of 50 most recent tracks
  - Has GET /tracks/:filename → serves the audio file
- package.json with express dependency

## File Location
- Music dir: /Users/clawman/Music/DJ/
- Project dir: /Users/clawman/.openclaw/workspace/xdj/

## Quality
- Must actually play audio
- Must handle large WAV files (stream, don't load entire file into memory at once if possible)
- Crossfader must work
- Jog wheels must spin
- Filter must sweep audibly

When completely finished, run this command to notify me:
openclaw system event --text "Done: XDJ-RR web controller v1 built — dual decks, jog wheels, crossfader, filters, beat matching. Run 'cd ~/workspace/xdj && node server.js' to start." --mode now
