/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import {Template, isTemplatePartActive} from '../lit-html.js';

const walkerNodeFilter = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT |
NodeFilter.SHOW_TEXT;

/**
 * Removes the list of nodes from a Template safely. In addition to removing
 * nodes from the Template, the Template part indices are updated to match
 * the mutated Template DOM.
 *
 * As the template is walked the removal state is tracked and
 * part indices are adjusted as needed.
 *
 * div
 *   div#1 (remove) <-- start removing (removing node is div#1)
 *     div
 *       div#2 (remove)  <-- continue removing (removing node is still div#1)
 *         div
 * div <-- stop removing since previous sibling is the removing node (div#1, removed 4 nodes)
 */
export function removeNodesFromTemplate(template: Template, nodesToRemove: Set<Node>) {
  const {element: {content}, parts} = template;
  const walker = document.createTreeWalker(
    content,
    walkerNodeFilter,
    null as any,
    false);
  let partIndex = 0;
  let part = parts[0];
  let nodeIndex = -1;
  let removeCount = 0;
  const nodesToRemoveInTemplate = [];
  let currentRemovingNode: Node|null = null;
  while (walker.nextNode()) {
    nodeIndex++;
    const node = walker.currentNode as Element;
    // end removal if stepped past the removing node
    if (node.previousSibling === currentRemovingNode) {
      currentRemovingNode = null;
    }
    // a node to remove was found in the template
    if (nodesToRemove.has(node)) {
      nodesToRemoveInTemplate.push(node);
      // track node we're removing
      if (currentRemovingNode === null) {
        currentRemovingNode = node;
      }
    }
    // when removing, increment count by which to adjust subsequent part indices
    if (currentRemovingNode !== null) {
      removeCount++;
    }
    while (part !== undefined && part.index === nodeIndex) {
      // if part is in a removed node deactivate it by setting index to -1 or
      // adjust the index as needed.
      part.index = currentRemovingNode !== null ? -1 : part.index - removeCount;
      part = parts[++partIndex];
    }
  }
  nodesToRemoveInTemplate.forEach((n) => n.parentNode!.removeChild(n));
}

const countNodes = (node: Node) => {
  let count = 1;
  const walker = document.createTreeWalker(
    node,
    walkerNodeFilter,
    null as any,
    false);
  while (walker.nextNode()) {
    count++;
  }
  return count;
}

/**
 * Inserts the given node into the Template, optionally before the given
 * refNode. In addition to inserting the node into the Template, the Template
 * part indices are updated to match the mutated Template DOM.
 */
export function insertNodeIntoTemplate(
    template: Template, node: Node, refNode: Node|null = null) {
  const {element: {content}, parts} = template;
  // if there's no refNode, then put node at end of template.
  // No part indices need to be shifted in this case.
  if (refNode === null || refNode === undefined) {
    content.appendChild(node);
    return;
  } else if (!content.contains(refNode)) {
    throw 'Reference node must be inside template.';
  }
  const walker = document.createTreeWalker(
      content,
      walkerNodeFilter,
      null as any,
      false);
  let partIndex = 0;
  // only need to modify active parts.
  let activeParts = parts.filter((part) => isTemplatePartActive(part));
  let part = activeParts[partIndex];
  let insertCount = 0;
  let walkerIndex = -1;
  while (walker.nextNode()) {
    walkerIndex++;
    const walkerNode = walker.currentNode as Element;
    if (walkerNode === refNode) {
      refNode.parentNode!.insertBefore(node, refNode);
      insertCount = countNodes(node);
    }
    while (part !== undefined && part.index === walkerIndex) {
      part.index += insertCount;
      part = activeParts[++partIndex];
    }
  }
}
