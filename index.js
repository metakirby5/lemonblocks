'use strict';

const blocks = require('./lib/blocks');

let b = new blocks.SsidBlock();

console.log(b.query());

b.on('update', () => {
  console.log(b.query());
});

