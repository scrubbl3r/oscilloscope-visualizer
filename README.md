# Local MIDI Oscilloscope Sampler

A monophonic, latched sample launcher with an oscilloscope visualizer.

## Run locally

Run:

```sh
./start-local.sh
```

Then open <http://localhost:8128>.

Do not open `index.html` using a `file://` URL. Web MIDI and sample loading
expect the application to be served from localhost.

## Sample bank

The local audio library lives in `samples/`. That directory is ignored by Git,
so large audio files cannot be committed or pushed accidentally.

The tracked `sample-bank.json` file maps samples to MIDI notes and computer keys.
The initial bank is:

| Computer key | MIDI note | Sample |
| --- | ---: | --- |
| `1` | 12 (C0) | `012-C0-tower-01-stems.wav` |
| `2` | 13 (C♯0) | `013-Cs0-mirror-mask-01.wav` |
| `3` | 14 (D0) | `014-D0-tower-02.wav` |

MIDI Note On starts the mapped sample. MIDI Note Off is ignored. Triggering
another sample immediately stops the current sample and starts the new one.
The existing Loop button controls whether the active sample repeats.
An unmapped note stops the active latch.

## MIDI controls

The physical number row maps chromatically: `1 2 3 4 5 6 7 8 9 0 - =`
corresponds to C0 through B0. Unmapped notes and number-row keys stop the active
sample latch.

Shift plus the same twelve physical keys maps to C1 through B1. C1 is reserved
for Sweep. C♯1 through B1 recall eleven locally stored emission presets.

The PRESETS button opens a floating capture editor. Selecting C♯1 through B1
loads that slot's locked settings, or the startup defaults for an empty slot.
While the editor is open, changes to Background, Core, Halo, Persistence,
Contrast, and Black Point update only the selected draft. Switching squares
preserves each draft independently. Closing the editor commits and locks every
draft in browser `localStorage`. The C1 square is non-interactive and shows the
Sweep state.

MIDI note 24 (C1) toggles Sweep mode. MIDI channel 1 controller assignments:

| CC | Control |
| ---: | --- |
| 20 | Persistence |
| 21 | Contrast |
| 22 | Black Point |
| 23 | Core/Halo balance |

Press `CONNECT` in the MIDI Bank section to grant Chromium access to a connected
MIDI keyboard.
