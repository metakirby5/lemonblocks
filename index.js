'use strict';

const blocks = require('./lib/blocks');

let b = new blocks.VolumeBlock();

console.log(b.query());

b.on('update', () => {
  console.log(b.query());
});

