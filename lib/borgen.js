import { findSection } from "./utils.js"

class Borgens {
  constructor(data) {
      Object.assign(this, data)
  }
}

class BorgensDB {
  constructor(db) {
      this.db = db
  }

  async learn(data) {
      if (!data.date) {
          throw "Date is required"
      }
      const tx = this.db.transaction("borgens", "readwrite")
      const existing = (await tx.store.get(data.date)) || {firstSeen: Date.now()}
      let change = false
      for (const key in data) {
          if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
              existing[key] = data[key]
              change = true
          }
      }
      if (change) {
          console.log(`BorgensDB: Learning new data about ${data.date}: ${JSON.stringify(data)}`)
          await Promise.all([
              tx.store.put(existing),
              tx.done,
          ])
      }
  }

  /**
   * Fetch data for an Borgen's shop.
   * @param {string} date
   */
  async get(date) {
      return new Borgens(await this.db.get("borgens", date))
  }
}

/**
 * Parse Borgen's data from tent.php.
 * @param {Document} dom
 * @param {URL} url
 */
const parseBorgens = (dom, url) => {
  const today = luxon.DateTime.fromObject({}, {zone: "America/Chicago"}).toISODate()
  const itemCard = findSection(dom, "Take a look")
  const items = []
  for (const elm of itemCard.querySelectorAll(".buybtn")) {
    const span = elm.querySelector("span")
    items.push({
      item: elm.dataset.id,
      price: parseInt(span.textContent.trim().replace(/,/g, ''), 10),
    })
  }
  return {date: today, items}
}

/**
 * Process settings.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} url
 */
const visitBorgens = async (state, dom, url) => {
  const data = parseBorgens(dom, url)
  if (data.items.length === 0) {
    console.debug("borgens", data)
    throw "Found zero items at Borgens, something is wrong"
  }
  await state.borgens.learn(data)
}

/**
 * Set up the borgens plugin.
 * @param {GlobalState} state
 */
export const setupBorgens = state => {
  state.borgens = new BorgensDB(state.db)
  state.addPageHandler("tent", visitBorgens, {parse: true})
}
