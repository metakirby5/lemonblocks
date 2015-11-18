'use strict';

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

module.exports = {
  getDescendants:     getDescendants,
  findFocused:        findFocused,
};

