// https://farmrpg.com/worker.php?go=givemailitem&id=303&to=22438&qty=1
import { findSection } from "./utils.js"

const levelRE = /Level (\d+)/

const NPCS = {
  "22438": "Rosalie",
  "22439": "Holger",
  "22440": "Beatrix",
  "22441": "Thomas",
  "22442": "Cecil",
  "22443": "George",
  "22444": "Jill",
  "22445": "Vincent",
  "22446": "Lorn",
  "22447": "Buddy",
  "53900": "Borgen",
  "59421": "Ric Ryph",
  "70604": "Mummy",
  "46158": "Star Meerif",
  "71760": "Charles",
  "71761": "ROOMBA",
  "71805": "Cpt Thomas",
  "84518": "frank",
}

export const REVERSE_NPCS = {}
for (const npcId in NPCS) {
  REVERSE_NPCS[NPCS[npcId]] = npcId
}
// Expand some short aliases.
REVERSE_NPCS["Captain Thomas"] = REVERSE_NPCS["Cpt Thomas"]
REVERSE_NPCS["Star"] = REVERSE_NPCS["Star Meerif"]
REVERSE_NPCS["Ric"] = REVERSE_NPCS["Ric Ryph"]

// Currently known likes and loves.
// python -c 'import yaml, json; print(json.dumps({row["name"]: {"loves": row["loves"], "likes": row["likes"]} for row in yaml.safe_load(open("../data/npc_items.yaml"))}, indent=2))'
export const NPC_OPINIONS = {
  "Beatrix": {
    "loves": [
      "Black Powder",
      "Explosive",
      "Fireworks",
      "Iced Tea"
    ],
    "likes": [
      "Bird Egg",
      "Carbon Sphere",
      "Coal",
      "Hammer",
      "Hops",
      "Oak"
    ]
  },
  "Borgen": {
    "loves": [
      "Cheese",
      "Gold Catfish",
      "Wooden Box"
    ],
    "likes": [
      "Glass Orb",
      "Gold Carrot",
      "Gold Cucumber",
      "Gold Peas",
      "Milk",
      "Slimestone"
    ]
  },
  "Buddy": {
    "loves": [
      "Pirate Bandana",
      "Pirate Flag",
      "Purple Flower",
      "Valentines Card"
    ],
    "likes": [
      "Bone",
      "Bucket",
      "Giant Centipede",
      "Gold Peppers",
      "Gummy Worms",
      "Mushroom",
      "Snail",
      "Spider"
    ]
  },
  "Cecil": {
    "loves": [
      "Grasshopper",
      "Horned Beetle",
      "Leather",
      "Old Boot",
      "Shiny Beetle",
      "Yarn"
    ],
    "likes": [
      "Aquamarine",
      "Giant Centipede",
      "Grapes",
      "Ladder",
      "Slimestone",
      "Snail"
    ]
  },
  "Charles": {
    "loves": [
      "Apple",
      "Apple Cider",
      "Box of Chocolate",
      "Gold Carrot",
      "Peach",
      "Valentines Card"
    ],
    "likes": [
      "Carrot",
      "Grasshopper",
      "Twine"
    ]
  },
  "Cpt Thomas": {
    "loves": [
      "Fishing Net",
      "Gold Catfish",
      "Gold Drum",
      "Gold Trout",
      "Large Net"
    ],
    "likes": [
      "Blue Crab",
      "Minnows"
    ]
  },
  "George": {
    "loves": [
      "Apple Cider",
      "Carbon Sphere",
      "Hide",
      "Mug of Beer",
      "Spider"
    ],
    "likes": [
      "Arrowhead",
      "Bird Egg",
      "Glass Orb",
      "Hops",
      "Mushroom Stew",
      "Orange Juice"
    ]
  },
  "Holger": {
    "loves": [
      "Gold Trout",
      "Mug of Beer",
      "Potato"
    ],
    "likes": [
      "Apple Cider",
      "Arrowhead",
      "Bluegill",
      "Carp",
      "Cheese",
      "Horn",
      "Largemouth Bass",
      "Mushroom Stew",
      "Peach",
      "Peas",
      "Trout"
    ]
  },
  "Jill": {
    "loves": [
      "Leather",
      "Mushroom Paste",
      "Peach",
      "Yellow Perch"
    ],
    "likes": [
      "Cheese",
      "Grapes",
      "Milk",
      "Old Boot",
      "Scrap Metal",
      "Tomato"
    ]
  },
  "Lorn": {
    "loves": [
      "Glass Orb",
      "Gold Peas",
      "Milk",
      "Shrimp",
      "Small Prawn"
    ],
    "likes": [
      "3-leaf Clover",
      "Apple Cider",
      "Bucket",
      "Green Parchment",
      "Iced Tea",
      "Iron Cup",
      "Peas",
      "Purple Parchment"
    ]
  },
  "Mummy": {
    "loves": [
      "Bone",
      "Spider",
      "Valentines Card"
    ],
    "likes": [
      "Fish Bones",
      "Hammer",
      "Treat Bag 02",
      "Yarn"
    ]
  },
  "ROOMBA": {
    "loves": [
      "Carbon Sphere",
      "Scrap Metal"
    ],
    "likes": [
      "Glass Orb",
      "Hammer",
      "Scrap Wire"
    ]
  },
  "Ric Ryph": {
    "loves": [
      "5 Gold",
      "Hammer",
      "Mushroom Paste",
      "Shovel"
    ],
    "likes": [
      "Arrowhead",
      "Black Powder",
      "Bucket",
      "Carbon Sphere",
      "Coal",
      "Green Parchment",
      "Old Boot",
      "Unpolished Shimmer Stone"
    ]
  },
  "Rosalie": {
    "loves": [
      "Blue Dye",
      "Box of Chocolate",
      "Gold Carrot",
      "Green Dye",
      "Purple Dye",
      "Red Dye",
      "Valentines Card"
    ],
    "likes": [
      "Apple",
      "Apple Cider",
      "Aquamarine",
      "Carrot",
      "Caterpillar",
      "Fireworks",
      "Iced Tea",
      "Purple Flower"
    ]
  },
  "Star Meerif": {
    "loves": [
      "Blue Feathers",
      "Gold Feather"
    ],
    "likes": [
      "Eggs",
      "Feathers"
    ]
  },
  "Thomas": {
    "loves": [
      "Fishing Net",
      "Flier",
      "Gold Catfish",
      "Gold Trout",
      "Goldgill"
    ],
    "likes": [
      "Carp",
      "Drum",
      "Gummy Worms",
      "Iced Tea",
      "Largemouth Bass",
      "Mealworms",
      "Minnows"
    ]
  },
  "Vincent": {
    "loves": [
      "5 Gold",
      "Apple Cider",
      "Axe",
      "Lemonade",
      "Mushroom Paste",
      "Onion Soup",
      "Orange Juice"
    ],
    "likes": [
      "Acorn",
      "Apple",
      "Cheese",
      "Hops",
      "Horn",
      "Leather Diary",
      "Shovel",
      "Wooden Box"
    ]
  },
  "frank": {
    "loves": [
      "Carrot",
      "Gold Carrot"
    ],
    "likes": [
      "Blue Dye",
      "Blue Feathers",
      "Bucket",
      "Caterpillar",
      "Feathers",
      "Grasshopper"
    ]
  }
}


/**
 * Parse npclevels.php.
 * @param {Document} dom
 * @param {URL} url
 */
const parseNpcLevels = (dom, url) => {
  const card = findSection(dom, "Current Levels")
  const npcLevels = []
  for (const linkElm of card.querySelectorAll('a')) {
    const elm = linkElm.parentElement
    const nameElm = elm.querySelector("strong")
    if (!nameElm) {
      throw `Unable to find name in ${elm.innerHTML}`
    }
    const progressElm = elm.querySelector(".progressbar")
    if (!progressElm) {
      throw `Unable to find progress bar in ${elm.innerHTML}`
    }
    const levelMatch = elm.innerText.match(levelRE)
    if (!levelMatch) {
      throw `Unable to find level in ${elm.innerText}`
    }

    npcLevels.push({
      name: nameElm.innerText,
      level: parseInt(levelMatch[1], 10),
      progress: progressElm.dataset.progress === "NAN" ? 0 : parseFloat(progressElm.dataset.progress),
    })
  }
  return npcLevels
}

const visitNpcLevels = async (state, dom, url) => {
  state.player.npcLevels = parseNpcLevels(dom, url)
  state.lastView = "npcLevels"
}

const fetchNpcLevels = async (state) => {
  await state.fetchPage("https://farmrpg.com/npclevels.php", visitNpcLevels, {parse: true})
}

/**
 * Handle before go=givemailitem
 * @param {GlobalState} state
 * @param {URL} url
 */
const beforeGiveMailItem = async (state, url) => {
  const to = NPCS[url.searchParams.get("to")]
  if (to !== undefined) {
    await fetchNpcLevels(state)
    state.preMailNpcLevel = state.player.npcLevels.find(l => l.name === to)
  }
}

/**
 * Handle go=givemailitem
 * @param {GlobalState} state
 * @param {string} url
 */
const visitGiveMailItem = async (state, page, _, url) => {
  const to = NPCS[url.searchParams.get("to")]
  if (to === undefined) {
    // Not an NPC, moving on.
    return
  }
  if (page !== "success") {
    // Something weird happened.
    console.error(`Error mailing an NPC ${to} item`, page)
    return
  }
  if (!state.preMailNpcLevel) {
    throw "Can't find pre-mail NPC levels"
  }
  // Diff against the before.
  await fetchNpcLevels(state)
  const npcLevel = state.player.npcLevels.find(l => l.name === to)
  const result = {
    to: to,
    toId: url.searchParams.get("to"),
    itemId: url.searchParams.get("id"),
    quantity: url.searchParams.get("qty"),
    before: {
      level: state.preMailNpcLevel.level,
      progress: state.preMailNpcLevel.progress,
    },
    after: {
      level: npcLevel.level,
      progress: npcLevel.progress,
    },
  }
  console.log("Got NPC mail result", result)
  state.log.npcMail(result)
}

export const setupNpcFriendship = state => {
  state.addPageHandler("npclevels", visitNpcLevels, {parse: true})
  // Items all spaded, disabling this for now.
  // state.addBeforeWorkerHandler("givemailitem", beforeGiveMailItem)
  // state.addWorkerHandler("givemailitem", visitGiveMailItem)
  // state.sendNpcItem = (itemId, count) => sendNpcItem(state, itemId, count)
  // state.sendNpcItems = async (itemIds) => {
  //   for (const itemId of itemIds) {
  //     await sendNpcItem(state, itemId, 1)
  //   }
  // }
}

const sendNpcItem = async (state, itemId, count) => {
  for (const toId in NPCS) {
    for (let i=0; i<count; i++) {
      await state.fetchPage(`https://farmrpg.com/worker.php?go=givemailitem&id=${itemId}&to=${toId}&qty=1`, visitGiveMailItem, {
        method: "POST",
        beforeHandler: beforeGiveMailItem,
      })
    }
  }
}
