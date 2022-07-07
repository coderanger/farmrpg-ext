import { findSection } from "./utils.js"

const itemAndQuantityRE = /^\s*(.+?) \(x([0-9,]+)\)/m
const oneShotRE = /This offer can only ever be accepted once/

/**
 * @typedef {{
 *   date: string
 *   giveItem: string
 *   giveQuantity: number
 *   receiveItem: string
 *   receiveQuantity: number
 *   completed: boolean
 *   oneShot: boolean
 * }} TradeData
 */

/**
 * A single Exchange Center trade.
 */
class Trade {
  /**
   * @param {TradeData} data
   */
  constructor(data) {
    Object.assign(this, data)
  }
}

class ExchangeCenterDB {
  /**
   * @param {idb.DB} db
   */
  constructor(db) {
    this.db = db
  }

  /**
   * Add data about a trade to the DB.
   * @param {TradeData} data
   */
  async learn(data) {
    if (!data.date) {
      throw "Date is required"
    }
    if (!data.giveItem) {
      throw "Give Item is required"
    }
    if (!data.receiveItem) {
      throw "Receive Item is required"
    }
    const tx = this.db.transaction("exchangeCenter", "readwrite")
    const existing = (await tx.store.get([data.date, data.giveItem, data.receiveItem])) || { firstSeen: Date.now() }
    let change = false
    for (const key in data) {
      if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
        existing[key] = data[key]
        change = true
      }
    }
    if (change) {
      console.log(`ExchangeCenterDB: Learning new data about ${data.date} ${data.giveItem} ${data.receiveItem}: ${JSON.stringify(data)}`)
      await Promise.all([
        tx.store.put(existing),
        tx.done,
      ])
    }
  }
}

/**
 * Parse data from exchange.php.
 * @param {Document} dom
 * @param {URL} url
 */
const parseExchangeCenter = (dom, url) => {
  const now = luxon.DateTime.fromObject({}, {zone: "America/Chicago"})
  const hour = now.hour < 12 ? 0 : 12
  const today = `${now.toISODate()}-${hour}`
  const trades = []
  // Grab the first trade.
  let tradeElm = findSection(dom, "Current Offers")
  while (tradeElm.classList.contains("card")) {
    // Parse the current trade.
    const cols = tradeElm.querySelectorAll(".col-50")
    const giveMatch = cols[0].textContent.match(itemAndQuantityRE)
    const receiveMatch = cols[1].textContent.match(itemAndQuantityRE)
    if (!giveMatch) {
      throw "Unable to find Trade In"
    }
    if (!receiveMatch) {
      throw "Unable to find You Receive"
    }
    const buttonElm = tradeElm.nextElementSibling
    const completed = buttonElm.classList.contains("btngray")
    const oneShotElm = tradeElm.querySelector(".row").nextElementSibling
    const oneShot = oneShotElm && oneShotRE.test(oneShotElm.textContent)
    trades.push({
      date: today,
      giveItem: giveMatch[1],
      giveQuantity: parseInt(giveMatch[2].replace(/,/g, ''), 10),
      receiveItem: receiveMatch[1],
      receiveQuantity: parseInt(receiveMatch[2].replace(/,/g, ''), 10),
      completed,
      oneShot: !!oneShot,
    })

    // Advance to the next.
    tradeElm = buttonElm.nextElementSibling
  }
  return trades
}

/**
 * Process exchange.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} url
 */
 const visitExchangeCenter = async (state, dom, url) => {
  const trades = parseExchangeCenter(dom, url)
  for (const trade of trades) {
    await state.exchangeCenter.learn(trade)
  }
}

/**
 * Set up the Exchange Center plugin.
 * @param {GlobalState} state
 */
export const setupExchangeCenter = state => {
  state.exchangeCenter = new ExchangeCenterDB(state.db)
  state.addPageHandler("exchange", visitExchangeCenter, {parse: true})
}
/**
 * Update exchange center data manually.
 * @param {GlobalState} state
 */
 export const fetchExchangeCenter = async state => {
  await state.fetchPage("https://farmrpg.com/exchange.php", visitExchangeCenter, {parse: true})
}
