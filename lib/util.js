'use strict';

const process = require('process');
const fs      = require('fs');

const tmp     = require('tmp');
const _       = require('lodash');

const config  = require('./config');

const LOG_BLOCKS_FILE = tmp.tmpNameSync(),
      LOG_SEP         = ',',
      CONTROL_BLOCK_REGEX = /^%{.*}$/;

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
// if updateBlocks provided, emit SIGUSR1 (by default) to self
// sigusr2 = true will send a SIGUSR2 instead
// blocks to update can be found via getUpdateBlocks
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

// Creates an "animation array"
// Every element is one character, but control blocks are kept intact
// Strip all clickable areas out
function createAnimationArray(text) {
    return _.flatten(text.replace(/(%{.*?})/g, '\n$1\n').split('\n')
      .filter((el) => !el.match(/^%{A.*}$/)).map((el) => {
        return el.match(CONTROL_BLOCK_REGEX) ? el : el.split('');
      })
    );
}

// Animates through an "animation array"
// Returns the next index, skipping control blocks
function nextAnimationIdx(animArr, idx, backwards) {
  let skip = 1;
  if (!backwards) {
    while (idx + skip < animArr.length && animArr[idx + skip].match(CONTROL_BLOCK_REGEX))
      skip++;
    return Math.min(animArr.length, idx + skip);
  } else {
    while (idx - skip >= 0 && animArr[idx - skip].match(CONTROL_BLOCK_REGEX))
      skip++;
    return Math.max(0, idx - skip);
  }
}

module.exports = {
  onCleanup:          onCleanup,
  getDescendants:     getDescendants,
  findFocused:        findFocused,
  addAction:          addAction,
  getUpdateBlocks:    getUpdateBlocks,
  addBG:              addBG,
  addFullBG:          addFullBG,
  toggleAttr:         toggleAttr,
  createAnimationArray: createAnimationArray,
  nextAnimationIdx:   nextAnimationIdx
};

