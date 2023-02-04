/** @typedef {{
 *    item: string
 *    action: "sell" | "mail"
 *    target?: string | undefined
 *    arg: string
 *    keep?: number | undefined
 * }} QuickAction */


/** @type {Record<string, QuickAction>} */
export const DEFAULT_QUICK_ACTIONS = {}

/**
 * Register a default quick action.
 * @param {QuickAction[]} actions
 */
const initialize = (actions) => {
  for(const action of actions) {
    DEFAULT_QUICK_ACTIONS[action.item] = action
  }
}

initialize([
  // Sell actions.
  {
    item: "Unpolished Garnet",
    action: "sell",
    target: "Garnet Ring",
    keep: 0.5,
  },
  {
    item: "Candy",
    action: "sell",
  },
  {
    item: "Taffy",
    action: "sell",
  },
  {
    item: "Lollipop",
    action: "sell",
  },
  // Mail actions.
  {
    item: "3-leaf Clover",
    action: "mail",
    arg: "Lorn",
  },
  {
    item: "Acorn",
    action: "mail",
    arg: "Vincent",
  },
  {
    item: "Apple",
    action: "mail",
    arg: "Charles",
  },
  {
    item: "Blue Crab",
    action: "mail",
    arg: "Captain Thomas",
  },
  {
    item: "Blue Feathers",
    action: "mail",
    arg: "Star",
    keep: 0.5,
  },
  {
    item: "Bluegill",
    action: "mail",
    arg: "Holger",
  },
  {
    item: "Bone",
    action: "mail",
    arg: "Mummy",
    keep: 0.5,
  },
  {
    item: "Coal",
    action: "mail",
    arg: "Ric",
    keep: 0.2,
  },
  {
    item: "Gummy Worms",
    action: "mail",
    arg: "Buddy",
    keep: 0.05,
  },
  {
    item: "Iron Cup",
    action: "mail",
    arg: "Lorn",
  },
  {
    item: "Largemouth Bass",
    action: "mail",
    arg: "Thomas",
  },
  {
    item: "Milk",
    action: "mail",
    arg: "Lorn",
    keep: 0.5,
  },
  {
    item: "Minnows",
    action: "mail",
    arg: "Thomas",
  },
  {
    item: "Oak",
    action: "mail",
    arg: "Beatrix",
  },
  {
    item: "Scrap Metal",
    action: "mail",
    arg: "ROOMBA",
  },
  {
    item: "Scrap Wire",
    action: "mail",
    arg: "ROOMBA",
  },
  {
    item: "Shiny Beetle",
    action: "mail",
    arg: "Cecil",
    keep: 0.25,
  },
  {
    item: "Shrimp",
    action: "mail",
    arg: "Lorn",
    keep: 0.25,
  },
  {
    item: "Slimestone",
    action: "mail",
    arg: "Borgen",
    keep: 0.25,
  },
  {
    item: "Small Prawn",
    action: "mail",
    arg: "Lorn",
    keep: 0.25,
  },
  {
    item: "Stone",
    action: "mail",
    target: "Iron Cup",
    arg: "Lorn",
  },
  {
    item: "Spider",
    action: "mail",
    arg: "Mummy",
    keep: 0.75,
  },
  {
    item: "Trout",
    action: "mail",
    arg: "Holger",
  },
  {
    item: "Wooden Box",
    action: "mail",
    arg: "Borgen",
  },
  {
    item: "Yellow Perch",
    action: "mail",
    arg: "Jill",
    keep: 0.1,
  },
])
