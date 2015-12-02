'use strict';

const process = require('process');

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

function addAction(text, action, button, sigpoll) {
  button = button || '';
  sigpoll = sigpoll || false;
  if (sigpoll)
    action = `${action}; kill -SIGUSR1 ${process.pid}`;

  return `%{A${button}:${action.replace(':', '\\:')}:}${text}%{A}`;
}

module.exports = {
  getDescendants:     getDescendants,
  findFocused:        findFocused,
  addAction:          addAction,
};

