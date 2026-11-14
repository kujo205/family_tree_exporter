const MARGIN = 36;
const BANNER_HEIGHT = 96;
const BANNER_GAP = 40;
const LABEL_GUTTER = 164;
const BOX_WIDTH = 132;
const HORIZONTAL_GAP = 14;
const VERTICAL_GAP = 38;
const MIN_PAGE_WIDTH = 520;

const BOX_HEIGHT_BY_DETAIL = { compact: 50, detailed: 64 };

/**
 * @typedef {import('../crawler/crawl-ancestry.js').AncestryTree} AncestryTree
 *
 * @typedef {Object} LaidOutBox
 * @property {import('../familysearch-api/ancestry.js').Person} person
 * @property {number} generation 1 is the start person
 * @property {boolean} isRepeat the person already appears elsewhere; their ancestors are not drawn again
 * @property {number} x left edge, measured from the page's left
 * @property {number} y top edge, measured from the page's top
 * @property {number} width
 * @property {number} height
 *
 * @typedef {Object} Link
 * @property {{ x: number, y: number }} child top center of the child's box
 * @property {{ x: number, bottomY: number }[]} parents bottom center of each parent's box
 * @property {number} busY the height where the parents' branches meet the child's stem
 *
 * @typedef {Object} Row
 * @property {number} generation
 * @property {number} top
 * @property {number} height
 *
 * @typedef {Object} PortraitLayout
 * @property {number} width
 * @property {number} height
 * @property {number} maxGeneration
 * @property {number} margin
 * @property {number} bannerHeight
 * @property {number} labelWidth
 * @property {LaidOutBox[]} boxes
 * @property {Link[]} links
 * @property {Row[]} rows
 */

/**
 * Lays the start person at the bottom and ancestors above, giving each branch only as much width as it needs.
 * All measurements are from the page's top-left corner.
 * @param {{ tree: AncestryTree, detail: 'compact' | 'detailed' }} request
 * @returns {PortraitLayout}
 */
export function layoutPortraitTree({ tree, detail }) {
  const peopleById = new Map(tree.people.map((person) => [person.id, person]));
  const root = buildNode({
    personId: tree.rootId,
    generation: 1,
    context: { peopleById, parentIdsByPersonId: tree.parentIdsByPersonId, seenIds: new Set() },
  });
  measureSpan(root);
  placeSlots({ node: root, firstSlot: 0 });

  const boxHeight = BOX_HEIGHT_BY_DETAIL[detail] ?? BOX_HEIGHT_BY_DETAIL.compact;
  const maxGeneration = findMaxGeneration(root);
  const geometry = { boxHeight, maxGeneration };
  const boxes = [];
  const links = [];
  collectDrawing({ node: root, geometry, boxes, links });

  const slotWidth = BOX_WIDTH + HORIZONTAL_GAP;
  return {
    width: Math.max(MIN_PAGE_WIDTH, LABEL_GUTTER + root.span * slotWidth - HORIZONTAL_GAP + MARGIN),
    height: BANNER_HEIGHT + BANNER_GAP + maxGeneration * boxHeight + (maxGeneration - 1) * VERTICAL_GAP + MARGIN,
    maxGeneration,
    margin: MARGIN,
    bannerHeight: BANNER_HEIGHT,
    labelWidth: LABEL_GUTTER - MARGIN - 12,
    boxes,
    links,
    rows: buildRows(geometry),
  };
}

function buildNode({ personId, generation, context }) {
  const person = context.peopleById.get(personId);
  const isRepeat = context.seenIds.has(personId);
  context.seenIds.add(personId);
  const parentIds = isRepeat ? [] : orderParentIds({ parentIds: context.parentIdsByPersonId[personId] ?? [], context });
  const parents = parentIds.map((parentId) => buildNode({ personId: parentId, generation: generation + 1, context }));
  return { person, generation, isRepeat, parents, span: 1, centerSlot: 0 };
}

function orderParentIds({ parentIds, context }) {
  const knownIds = parentIds.filter((id) => context.peopleById.has(id));
  return [...knownIds].sort((first, second) => genderRank(context.peopleById.get(first)) - genderRank(context.peopleById.get(second)));
}

function genderRank(person) {
  if (person.gender === 'Male') {
    return 0;
  }
  return person.gender === 'Female' ? 2 : 1;
}

function measureSpan(node) {
  node.parents.forEach(measureSpan);
  node.span = node.parents.length === 0 ? 1 : node.parents.reduce((total, parent) => total + parent.span, 0);
}

function placeSlots({ node, firstSlot }) {
  let nextSlot = firstSlot;
  for (const parent of node.parents) {
    placeSlots({ node: parent, firstSlot: nextSlot });
    nextSlot += parent.span;
  }
  if (node.parents.length === 0) {
    node.centerSlot = firstSlot + 0.5;
    return;
  }
  const firstParent = node.parents[0];
  const lastParent = node.parents[node.parents.length - 1];
  node.centerSlot = (firstParent.centerSlot + lastParent.centerSlot) / 2;
}

function findMaxGeneration(node) {
  return Math.max(node.generation, ...node.parents.map(findMaxGeneration));
}

function collectDrawing({ node, geometry, boxes, links }) {
  const box = toBox({ node, geometry });
  boxes.push(box);
  if (node.parents.length > 0) {
    links.push(toLink({ box, node }));
  }
  for (const parent of node.parents) {
    collectDrawing({ node: parent, geometry, boxes, links });
  }
}

function toBox({ node, geometry }) {
  return {
    person: node.person,
    generation: node.generation,
    isRepeat: node.isRepeat,
    x: slotCenterX(node.centerSlot) - BOX_WIDTH / 2,
    y: rowTop({ generation: node.generation, geometry }),
    width: BOX_WIDTH,
    height: geometry.boxHeight,
  };
}

function toLink({ box, node }) {
  return {
    child: { x: box.x + BOX_WIDTH / 2, y: box.y },
    parents: node.parents.map((parent) => ({ x: slotCenterX(parent.centerSlot), bottomY: box.y - VERTICAL_GAP })),
    busY: box.y - VERTICAL_GAP / 2,
  };
}

function buildRows(geometry) {
  const rows = [];
  for (let generation = 1; generation <= geometry.maxGeneration; generation++) {
    rows.push({ generation, top: rowTop({ generation, geometry }), height: geometry.boxHeight });
  }
  return rows;
}

function slotCenterX(centerSlot) {
  return LABEL_GUTTER + centerSlot * (BOX_WIDTH + HORIZONTAL_GAP);
}

function rowTop({ generation, geometry }) {
  const rowFromTop = geometry.maxGeneration - generation;
  return BANNER_HEIGHT + BANNER_GAP + rowFromTop * (geometry.boxHeight + VERTICAL_GAP);
}
