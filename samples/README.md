# Sample Folder and Mapping

Put the large WAV files in this folder. The audio files are deliberately excluded
from Git and from the distributable application ZIP.

## Exact startup filenames

The current `sample-bank.json` expects these exact filenames:

| Computer key | Raw MIDI note | Musical label | Exact filename |
| --- | ---: | --- | --- |
| `1` | 12 | C0 | `012-C0-tower-01-stems.wav` |
| `2` | 13 | C♯0 | `013-Cs0-mirror-mask-01.wav` |
| `3` | 14 | D0 | `014-D0-tower-02.wav` |

Spelling, capitalization, punctuation, and the `.wav` extension must match. A
missing or differently named file cannot be loaded.

## How file-to-note mapping works

The application reads `sample-bank.json` when the page starts. Each entry joins
three things:

- `note`: the raw incoming MIDI note number
- `key`: the computer-keyboard test key
- `file`: the relative path to the WAV file in this folder

For example:

```json
{
  "note": 12,
  "key": "1",
  "name": "TOWER 01 STEMS",
  "file": "samples/012-C0-tower-01-stems.wav"
}
```

This means raw MIDI note 12 and computer key `1` both trigger
`012-C0-tower-01-stems.wav`.

The bank is monophonic and latched: starting a mapped sample stops the currently
playing sample and starts the new one. MIDI Note Off does not stop playback.
Looping is controlled by the Loop button in the interface.

## Adding or replacing samples

Replacing a sound without changing its assignment is simple: give the new WAV
the exact filename already listed above and replace the old file.

Adding another assignment requires a matching new entry in `sample-bank.json`.
The filename does not create the mapping by itself; `sample-bank.json` is the
single source of truth.

Chromatic sample notes continue from raw MIDI note 12:

| Note | Raw MIDI | Suggested filename prefix | Computer key |
| --- | ---: | --- | --- |
| C0 | 12 | `012-C0-` | `1` |
| C♯0 | 13 | `013-Cs0-` | `2` |
| D0 | 14 | `014-D0-` | `3` |
| D♯0 | 15 | `015-Ds0-` | `4` |
| E0 | 16 | `016-E0-` | `5` |
| F0 | 17 | `017-F0-` | `6` |
| F♯0 | 18 | `018-Fs0-` | `7` |
| G0 | 19 | `019-G0-` | `8` |
| G♯0 | 20 | `020-Gs0-` | `9` |
| A0 | 21 | `021-A0-` | `0` |
| A♯0 | 22 | `022-As0-` | `-` |
| B0 | 23 | `023-B0-` | `=` |

Text after the prefix can be a useful lowercase, hyphenated sound name. Keep the
full filename synchronized with the `file` value in `sample-bank.json`.
