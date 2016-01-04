'use strict';

const process = require('process');
const fs      = require('fs');

const tmp     = require('tmp');

const config  = require('./config');

const LOG_BLOCKS_FILE  = tmp.tmpNameSync(),
      LOG_SEP   = ',';

// http://stackoverflow.com/a/21947851
function onCleanup(callback) {
  callback = callback || () => {};
  process.on('cleanup', callback);
};

// Hook into exits to call cleanup
process.on('exit', function () {
  process.emit('cleanup');
});
process.on('SIGINT', function () {
  process.exit(2);
});
process.on('SIGTERM', function () {
  process.exit(9);
});
process.on('uncaughtException', function(e) {
  console.log(e.stack);
  process.exit(99);
});

// i3 utilities
function* getDescendants(root) {
  for (let bundle of [root.nodes, root.floating_nodes]) {
    for (let node of bundle) {
      yield node;
      for (let child of getDescendants(node))
        yield child;
    }
  }
}

function findFocused(root) {
  for (let node of getDescendants(root))
    if (node.focused) return node;
}

// updateBlocks should be an array of class names to update
// if updateBlocks provided, emit SIGUSR1 to self
// blocks to update can be found via getUpdateBlocks
// sigusr2 = true will send a sigusr2 instead
function addAction(text, action, button, updateBlocks, sigusr2) {
  action = action || ':'; // Default to no-op
  button = button || '';
  updateBlocks = updateBlocks || false;
  if (updateBlocks) {
    action = `${action}; echo "${updateBlocks.join(LOG_SEP)
      }" > ${
      LOG_BLOCKS_FILE}; kill -SIGUSR${sigusr2 ? 2 : 1} ${process.pid}`;
  }

  return `%{A${button}:${action.replace(':', '\\:')}:}${text}%{A}`;
}

function getUpdateBlocks(callback) {
  fs.readFile(LOG_BLOCKS_FILE, {encoding: 'utf8'}, (err, data) => {
    if (err)
      callback(err);

    let blocks = data.trim();
    callback(null, blocks ? blocks.split(LOG_SEP) : []);
  });
}

function addBG(text, beginColor, endColor) {
  return `%{B${config.get(beginColor)}}${text}%{B${endColor ? config.get(endColor) : '-'}}`;
}

function addFullBG(text, beginColor, endColor) {
  return `%{B${config.get(beginColor)}}%{U${config.get(beginColor)}}${
    text
  }%{U${config.get('cUnderline')}}%{B${endColor ? config.get(endColor) : '-'}}`;
}

function toggleAttr(text, attribute) {
  return `%{!${attribute}}${text}%{!${attribute}}`;
}

module.exports = {
  onCleanup:          onCleanup,
  getDescendants:     getDescendants,
  findFocused:        findFocused,
  addAction:          addAction,
  getUpdateBlocks:    getUpdateBlocks,
  addBG:              addBG,
  addFullBG:          addFullBG,
  toggleAttr:         toggleAttr
};

