'use strict';
const blocks = require('./lib/blocks');

let b = new blocks.WorkspaceBlock();

let cb = function() {
  console.log(b.query());
}

b.on('update', cb);

