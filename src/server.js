'use strict';

const express = require('express');
const ChordBoxImage = require('./ChordBoxImage');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * GET /<ChordName>.png?p=<positions>&f=<fingers>&s=<size>
 *
 * Parameters (short or long form):
 *   p / pos     - 6-char fret positions, e.g. "x32010"  (x = muted, 0 = open)
 *   f / fingers - 6-char finger numbers, e.g. "--1213"  (- = none, 1-4, T = thumb)
 *   s / size    - integer 1-10 (default 1)
 *
 * Example: /D.png?p=xx0232&f=---132&s=3
 */
app.get(/^\/(.+)\.png$/i, (req, res) => {
  const chordName = req.params[0];
  const pos     = req.query.pos     || req.query.p || '000000';
  const fingers = req.query.fingers || req.query.f || '------';
  const size    = req.query.size    || req.query.s || '1';

  try {
    const image = new ChordBoxImage(chordName, pos, fingers, size);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days

    image.createPNGStream().pipe(res);
  } catch (err) {
    console.error('Error generating chord image:', err);
    res.status(500).send('Error generating chord image');
  }
});

app.listen(PORT, () => {
  console.log(`Chord Image Generator listening on http://localhost:${PORT}`);
  console.log('Example: http://localhost:' + PORT + '/D.png?p=xx0232&f=---132&s=3');
});
