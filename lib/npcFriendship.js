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
  state.addBeforeWorkerHandler("givemailitem", beforeGiveMailItem)
  state.addWorkerHandler("givemailitem", visitGiveMailItem)
  state.sendNpcItem = (itemId, count) => sendNpcItem(state, itemId, count)
  state.sendNpcItems = async (itemIds) => {
    for (const itemId of itemIds) {
      await sendNpcItem(state, itemId, 1)
    }
  }
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
