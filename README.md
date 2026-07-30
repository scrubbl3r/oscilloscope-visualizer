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
| `1` | 36 | `036-tower-01-stems.wav` |
| `2` | 38 | `038-mirror-mask-01.wav` |

MIDI Note On starts the mapped sample. MIDI Note Off is ignored. Triggering
another sample immediately stops the current sample and starts the new one.
The existing Loop button controls whether the active sample repeats.

Press `CONNECT` in the MIDI Bank section to grant Chromium access to a connected
MIDI keyboard. Computer keys `1` and `2` work without MIDI hardware.
