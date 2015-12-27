'use strict';

const process = require('process');
const fs      = require('fs');

const tmp     = require('tmp');

const config  = require('./config');

const LOG_BLOCKS_FILE  = tmp.tmpNameSync(),
      LOG_BLOCKS_SEP   = ',';

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
function addAction(text, action, button, updateBlocks) {
  action = action || ':'; // Default to no-op
  button = button || '';
  updateBlocks = updateBlocks || false;
  if (updateBlocks)
    action = `${action}; echo ${'"' + updateBlocks.join(LOG_BLOCKS_SEP) + '"'
    } > ${LOG_BLOCKS_FILE}; kill -SIGUSR1 ${process.pid}`;

  return `%{A${button}:${action.replace(':', '\\:')}:}${text}%{A}`;
}

function getUpdateBlocks(callback) {
  fs.readFile(LOG_BLOCKS_FILE, {encoding: 'utf8'}, (err, data) => {
    if (err)
      callback(err);

    let blocks = data.trim();
    callback(null, blocks ? blocks.split(LOG_BLOCKS_SEP) : []);
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
  getDescendants:     getDescendants,
  findFocused:        findFocused,
  addAction:          addAction,
  getUpdateBlocks:    getUpdateBlocks,
  addBG:              addBG,
  addFullBG:          addFullBG,
  toggleAttr:         toggleAttr
};

