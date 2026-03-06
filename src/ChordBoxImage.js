/*
 * Chord Image Generator
 * http://einaregilsson.com/chord-image-generator/
 *
 * Original C# code Copyright (C) 2009-2019 Einar Egilsson [einar@einaregilsson.com]
 * Node.js port: MIT License
 *
 * Draws guitar chord box diagrams and returns them as PNG buffers or streams.
 * Uses node-canvas (Cairo-backed) in place of GDI+.
 */
'use strict';

const { createCanvas } = require('canvas');

const NO_FINGER = '-';
const OPEN = 0;
const MUTED = -1;
const FRET_COUNT = 5;
const FONT_NAME = 'Arial';

// Approximate GDI+ Arial CellAscent/LineSpacing ratio (~1854/2048 for Arial).
// Used to scale font sizes the same way the original C# code did.
const FONT_PERC = 0.905;

class ChordBoxImage {
  constructor(name, chord, fingers, size, baseFret, tuning) {
    this._chordPositions = [0, 0, 0, 0, 0, 0];
    this._fingers = [NO_FINGER, NO_FINGER, NO_FINGER, NO_FINGER, NO_FINGER, NO_FINGER];
    this._error = false;
    this._baseFret = 1;
    this._tuning = null;

    this._chordName = this._parseName(name);
    this._parseChord(chord);
    this._parseBaseFret(baseFret);
    this._parseFingers(fingers);
    this._parseSize(size);
    this._parseTuning(tuning);
    this._initializeSizes();
    this._createImage();
  }

  /** Returns a Buffer containing the PNG image. */
  getBuffer() {
    return this._canvas.toBuffer('image/png');
  }

  /** Returns a readable stream of the PNG image. */
  createPNGStream() {
    return this._canvas.createPNGStream();
  }

  // ---------------------------------------------------------------------------
  // Parsing
  // ---------------------------------------------------------------------------

  _parseName(name) {
    if (!name) return '';
    // Parts split by '_': even-indexed are normal text, odd-indexed are superscripts.
    // Replace '#' with ♯ and 'b'/'B' with ♭ for single-character segments.
    const parts = name.split('_');
    for (let i = 1; i < parts.length; i++) {
      if (i % 2 === 0) continue;
      if (parts[i].length === 1) {
        parts[i] = parts[i].replace('#', '\u266f');
        parts[i] = parts[i].replace('b', '\u266d').replace('B', '\u266d');
      }
    }
    return parts.join('_');
  }

  _parseSize(size) {
    if (size == null) {
      this._size = 1;
    } else {
      const d = parseFloat(size);
      this._size = isNaN(d) ? 1 : Math.min(Math.max(1, Math.round(d)), 10);
    }
  }

  _parseBaseFret(baseFret) {
    if (baseFret == null) return;
    const bf = parseInt(baseFret, 10);
    if (isNaN(bf) || bf < 1) return;
    // Incoming positions are relative (1 = first shown fret); convert to absolute.
    for (let i = 0; i < 6; i++) {
      if (this._chordPositions[i] > 0) {
        this._chordPositions[i] += bf - 1;
      }
    }
    this._baseFret = bf;
  }

  _parseTuning(tuning) {
    if (!tuning) return;
    const parts = tuning.split(',').map(s => s.trim());
    if (parts.length !== 6) return;
    this._tuning = parts;
  }

  _parseFingers(fingers) {
    if (fingers == null) return;
    if (!/^[tT\-1234]{6}$/.test(fingers)) {
      this._error = true;
    } else {
      this._fingers = fingers.toUpperCase().split('');
    }
  }

  _parseChord(chord) {
    const simple = /^[\dxX]{6}$/.test(chord);
    const extended = /^((1|2)?[\dxX]-){5}(1|2)?[\dxX]$/.test(chord);
    if (chord == null || (!simple && !extended)) {
      this._error = true;
      return;
    }

    const parts = chord.length > 6 ? chord.split('-') : chord.split('');
    let maxFret = 0;
    let minFret = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < 6; i++) {
      if (parts[i].toUpperCase() === 'X') {
        this._chordPositions[i] = MUTED;
      } else {
        this._chordPositions[i] = parseInt(parts[i], 10);
        maxFret = Math.max(maxFret, this._chordPositions[i]);
        if (this._chordPositions[i] !== 0) {
          minFret = Math.min(minFret, this._chordPositions[i]);
        }
      }
    }

    this._baseFret = maxFret <= 5 ? 1 : minFret;
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  _initializeSizes() {
    const s = this._size;

    this._fretWidth = 4 * s;
    this._nutHeight = this._fretWidth / 2;
    this._lineWidth = Math.ceil(s * 0.31);
    this._dotWidth = Math.ceil(0.9 * this._fretWidth);
    this._markerWidth = 0.7 * this._fretWidth;
    this._boxWidth = 5 * this._fretWidth + 6 * this._lineWidth;
    this._boxHeight = FRET_COUNT * (this._fretWidth + this._lineWidth) + this._lineWidth;

    this._fretFontSize = this._fretWidth / FONT_PERC;
    this._fingerFontSize = this._fretWidth * 0.8;
    this._nameFontSize = (this._fretWidth * 2) / FONT_PERC;
    this._superScriptFontSize = 0.7 * this._nameFontSize;

    if (s === 1) {
      this._nameFontSize += 2;
      this._fingerFontSize += 2;
      this._fretFontSize += 2;
      this._superScriptFontSize += 2;
    }

    this._xstart = this._fretWidth;
    this._ystart = Math.round(
      0.2 * this._superScriptFontSize + this._nameFontSize + this._nutHeight + 1.7 * this._markerWidth
    );
    this._tuningFontSize = this._fingerFontSize;
    this._imageWidth = Math.round(this._boxWidth + 5 * this._fretWidth);
    this._imageHeight = Math.round(this._boxHeight + this._ystart + 2 * this._fretWidth);
    if (this._tuning) {
      this._imageHeight += Math.ceil(this._tuningFontSize * 1.4);
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------

  _createImage() {
    this._canvas = createCanvas(this._imageWidth, this._imageHeight);
    this._ctx = this._canvas.getContext('2d');
    this._ctx.antialias = 'subpixel';

    // White background
    this._ctx.fillStyle = 'white';
    this._ctx.fillRect(0, 0, this._imageWidth, this._imageHeight);

    if (this._error) {
      this._ctx.strokeStyle = 'red';
      this._ctx.lineWidth = 3;
      this._ctx.beginPath();
      this._ctx.moveTo(0, 0);
      this._ctx.lineTo(this._imageWidth, this._imageHeight);
      this._ctx.stroke();
      this._ctx.beginPath();
      this._ctx.moveTo(0, this._imageHeight);
      this._ctx.lineTo(this._imageWidth, 0);
      this._ctx.stroke();
    } else {
      this._drawChordBox();
      this._drawChordPositions();
      this._drawChordName();
      this._drawFingers();
      this._drawTuning();
      this._drawBars();
    }
  }

  _drawChordBox() {
    const ctx = this._ctx;
    const { _xstart: xs, _ystart: ys, _fretWidth: fw, _lineWidth: lw,
            _boxWidth: bw, _boxHeight: bh, _baseFret: bf, _nutHeight: nh } = this;
    const totalFretWidth = fw + lw;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = lw;

    // Horizontal fret lines
    for (let i = 0; i <= FRET_COUNT; i++) {
      const y = ys + i * totalFretWidth;
      ctx.beginPath();
      ctx.moveTo(xs, y);
      ctx.lineTo(xs + bw - lw, y);
      ctx.stroke();
    }

    // Vertical string lines
    for (let i = 0; i < 6; i++) {
      const x = xs + i * totalFretWidth;
      ctx.beginPath();
      ctx.moveTo(x, ys);
      ctx.lineTo(x, ys + bh - lw);
      ctx.stroke();
    }

    // Nut (thick top bar when starting from fret 1)
    if (bf === 1) {
      ctx.fillStyle = 'black';
      ctx.fillRect(xs - lw / 2, ys - nh, bw, nh);
    }
  }

  _drawBars() {
    const { _chordPositions: pos, _fingers: fingers, _xstart: xs, _ystart: ys,
            _fretWidth: fw, _lineWidth: lw, _dotWidth: dw, _baseFret: bf } = this;
    const totalFretWidth = fw + lw;
    const arcWidth = dw / 7;

    // Find barre chords: same finger on same fret across multiple strings
    const bars = new Map();
    for (let i = 0; i < 5; i++) {
      if (pos[i] !== MUTED && pos[i] !== OPEN && fingers[i] !== NO_FINGER && !bars.has(fingers[i])) {
        const bar = { str: i, pos: pos[i], length: 0, finger: fingers[i] };
        for (let j = i + 1; j < 6; j++) {
          if (fingers[j] === bar.finger && pos[j] === pos[i]) {
            bar.length = j - i;
          }
        }
        if (bar.length > 0) bars.set(bar.finger, bar);
      }
    }

    for (const bar of bars.values()) {
      const yTempOffset = bar.pos === 1 ? -0.3 * totalFretWidth : 0;
      const xstart = xs + bar.str * totalFretWidth - dw / 2;
      const y = ys + (bar.pos - bf) * totalFretWidth - 0.6 * totalFretWidth + yTempOffset;
      const barWidth = bar.length * totalFretWidth + dw;

      // Three arcs mimic GDI+'s rounded barre indicator
      this._drawGdiArc(xstart, y,              barWidth, totalFretWidth,            -1,  -178, arcWidth);
      this._drawGdiArc(xstart, y - arcWidth,   barWidth, totalFretWidth + arcWidth, -4,  -172, 1.3 * arcWidth);
      this._drawGdiArc(xstart, y - 1.5*arcWidth, barWidth, totalFretWidth + 3*arcWidth, -20, -150, 1.3 * arcWidth);
    }
  }

  /**
   * Replicates GDI+ DrawArc(pen, x, y, width, height, startAngleDeg, sweepAngleDeg).
   * GDI+ uses a bounding-rectangle API; Canvas uses center + radii.
   */
  _drawGdiArc(x, y, width, height, startAngleDeg, sweepAngleDeg, lineWidth) {
    const ctx = this._ctx;
    const toRad = Math.PI / 180;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      startAngleDeg * toRad,
      (startAngleDeg + sweepAngleDeg) * toRad,
      sweepAngleDeg < 0  // counterclockwise when sweep is negative
    );
    ctx.stroke();
  }

  _drawChordPositions() {
    const ctx = this._ctx;
    const { _chordPositions: pos, _xstart: xs, _ystart: ys, _fretWidth: fw,
            _lineWidth: lw, _dotWidth: dw, _markerWidth: mw,
            _nutHeight: nh, _baseFret: bf } = this;
    const totalFretWidth = fw + lw;
    const yoffset = ys - fw;

    for (let i = 0; i < pos.length; i++) {
      const absolutePos = pos[i];
      const relativePos = absolutePos - bf + 1;
      const xpos = xs - 0.5 * fw + 0.5 * lw + i * totalFretWidth;

      if (relativePos > 0) {
        // Filled dot — pressed fret
        const ypos = relativePos * totalFretWidth + yoffset;
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.ellipse(xpos + dw / 2, ypos + dw / 2, dw / 2, dw / 2, 0, 0, 2 * Math.PI);
        ctx.fill();
      } else if (absolutePos === OPEN) {
        // Open string circle above nut
        let ypos = ys - fw;
        if (bf === 1) ypos -= nh;
        const markerX = xpos + (dw - mw) / 2;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(markerX + mw / 2, ypos + mw / 2, mw / 2, mw / 2, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (absolutePos === MUTED) {
        // Muted string X above nut
        let ypos = ys - fw;
        if (bf === 1) ypos -= nh;
        const markerX = xpos + (dw - mw) / 2;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = lw * 1.5;
        ctx.beginPath();
        ctx.moveTo(markerX, ypos);
        ctx.lineTo(markerX + mw, ypos + mw);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(markerX, ypos + mw);
        ctx.lineTo(markerX + mw, ypos);
        ctx.stroke();
      }
    }
  }

  _drawFingers() {
    const ctx = this._ctx;
    const { _fingers: fingers, _xstart: xs, _ystart: ys,
            _boxHeight: bh, _fretWidth: fw, _lineWidth: lw, _fingerFontSize: fs } = this;

    ctx.font = `${fs}px ${FONT_NAME}`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';

    let xpos = xs + 0.5 * lw;
    const ypos = ys + bh;

    for (const finger of fingers) {
      if (finger !== NO_FINGER) {
        const w = ctx.measureText(finger).width;
        ctx.fillText(finger, xpos - 0.5 * w, ypos);
      }
      xpos += fw + lw;
    }
  }

  _drawTuning() {
    if (!this._tuning) return;
    const ctx = this._ctx;
    const { _tuning: tuning, _xstart: xs, _ystart: ys, _boxHeight: bh,
            _fretWidth: fw, _lineWidth: lw, _tuningFontSize: fs,
            _fingerFontSize: ffs } = this;

    ctx.font = `${fs}px ${FONT_NAME}`;
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';

    // Position just below the finger number row
    const ypos = ys + bh + ffs * 1.4;
    let xpos = xs + 0.5 * lw;

    for (const note of tuning) {
      const w = ctx.measureText(note).width;
      ctx.fillText(note, xpos - 0.5 * w, ypos);
      xpos += fw + lw;
    }
  }

  _drawChordName() {
    const ctx = this._ctx;
    const { _chordName: name, _xstart: xs, _boxWidth: bw,
            _imageWidth: iw, _nameFontSize: nfs,
            _superScriptFontSize: sfs, _fretFontSize: ffs,
            _fretWidth: fw, _ystart: ys, _baseFret: bf } = this;

    const nameFont  = `${nfs}px ${FONT_NAME}`;
    const superFont = `${sfs}px ${FONT_NAME}`;

    const parts = name.split('_');
    const maxParts = Math.min(parts.length, 4);

    // Measure total rendered width
    let totalWidth = 0;
    for (let i = 0; i < maxParts; i++) {
      ctx.font = i % 2 === 0 ? nameFont : superFont;
      totalWidth += (i % 2 === 0 ? 0.75 : 0.8) * ctx.measureText(parts[i]).width;
    }

    let xTextStart = xs;
    if (totalWidth < bw) {
      xTextStart = xs + (bw - totalWidth) / 2;
    } else if (xTextStart + totalWidth > iw) {
      const nx = (xTextStart + totalWidth) / 2;
      xTextStart = nx < iw / 2 ? iw / 2 - nx : 2;
    }

    ctx.fillStyle = 'black';
    ctx.textBaseline = 'top';

    for (let i = 0; i < maxParts; i++) {
      const isSuper = i % 2 !== 0;
      ctx.font = isSuper ? superFont : nameFont;
      const w = ctx.measureText(parts[i]).width;
      const yText = isSuper ? 0 : 0.2 * sfs;
      ctx.fillText(parts[i], xTextStart, yText);
      xTextStart += (isSuper ? 0.8 : 0.75) * w;
    }

    if (bf > 1) {
      ctx.font = `${ffs}px ${FONT_NAME}`;
      const offset = (ffs - fw) / 2;
      ctx.fillText(`${bf}fr`, xs + bw + 0.3 * fw, ys - offset);
    }
  }
}

module.exports = ChordBoxImage;
