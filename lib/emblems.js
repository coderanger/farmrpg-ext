class Emblem {
  constructor(data) {
      Object.assign(this, data)
  }
}

class EmblemDB {
  constructor(db) {
      this.db = db
  }

  async learn(data) {
      if (!data.id) {
          throw "ID is required"
      }
      const tx = this.db.transaction("emblems", "readwrite")
      const existing = (await tx.store.get(data.id)) || {firstSeen: Date.now()}
      let change = false
      for (const key in data) {
          if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
              existing[key] = data[key]
              change = true
          }
      }
      if (change) {
          console.log(`EmblemsDB: Learning new data about ${data.id}: ${JSON.stringify(data)}`)
          await Promise.all([
              tx.store.put(existing),
              tx.done,
          ])
      }
  }

  /**
   * Fetch data for an emblem.
   * @param {string} id
   */
  async get(id) {
      return new Emblem(await this.db.get("emblems", id))
  }
}

/**
 * Parse emblems data from settings.php.
 * @param {Document} dom
 * @param {URL} url
 */
const parseEmblems = (dom, url) => {
  const emblems = []
  for (const elm of dom.querySelectorAll(".setemblembtn")) {
    const img = elm.querySelector("img")
    const style = img.getAttribute("style") || ""
    if (style.includes("red")) {
      continue
    }
    emblems.push({
      id: elm.dataset.id,
      image: img.getAttribute("src"),
      beta: style.includes("orange"),
    })
  }
  return emblems
}

/**
 * Process settings.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} url
 */
const visitEmblems = async (state, dom, url) => {
  const emblems = parseEmblems(dom, url)
  for (const emblem of emblems) {
    await state.emblems.learn(emblem)
  }
}

/**
 * Set up the emblems plugin.
 * @param {GlobalState} state
 */
export const setupEmblems = state => {
  state.emblems = new EmblemDB(state.db)
  state.addPageHandler("settings", visitEmblems, {parse: true})
}

/**
 * Update emblems data manually.
 * @param {GlobalState} state
 */
 export const fetchEmblems = async state => {
  await state.fetchPage("https://farmrpg.com/settings.php", visitEmblems, {parse: true})
}
