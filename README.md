# Guitar Chord Image Generator

Node.js port of [einaregilsson/ChordImageGenerator](https://github.com/einaregilsson/ChordImageGenerator) (originally C# / ASP.NET Core). Generates guitar chord box diagrams as PNG images via HTTP.

## Stack

- **Node.js** with Express
- **canvas** v3+ (node-canvas, Cairo-backed)

## Installation

```bash
npm install
```

## Running

```bash
npm start
# Server listens on http://localhost:3000
```

Set `PORT` env var to use a different port.

## API

```
GET /<ChordName>.png?p=<positions>&f=<fingers>&s=<size>
```

### Parameters

| Param | Long form | Description |
|-------|-----------|-------------|
| `p`   | `pos`     | 6 fret positions: `x`=muted, `0`=open, `1-9`=fret number relative to `b` |
| `f`   | `fingers` | 6 finger numbers: `1-4`, `T`=thumb, `-`=none |
| `s`   | `size`    | Image size multiplier `1-10` (default: `1`) |
| `b`   | `baseFret`| Starting fret number (default: auto). When set, positions are relative to this fret and an `Xfr` label is shown. |

### Chord Name

The chord name comes from the URL path (without `.png`). Use `_` to insert superscript segments:

- Even `_`-separated parts → normal text
- Odd `_`-separated parts → superscript
- Single-char superscripts: `#` → ♯, `b`/`B` → ♭

### Examples

| URL | Chord |
|-----|-------|
| `/D.png?p=xx0232&f=---132&s=3` | D major, size 3 |
| `/G.png?p=320003&f=210003` | G major |
| `/Am.png?p=x02210&f=-01230` | A minor |
| `/F_#_m.png?p=133111&f=134111&b=2` | F♯m (barre at fret 2) |
| `/C_maj7.png?p=x32000&f=-32000` | Cmaj7 (superscript "maj7") |
