import { findSection } from "./utils.js"

const todayQuantityRE = /^\s*(\S.*?\S)\s*\(x?([0-9,]+)\)/m
const goalQuantityRE = /^\s*Goal:\s+(\S.*?\S)\s*\(x?([0-9,]+)\)/m
const rewardQuantityRE = /^\s*Reward:\s+(\S.*?\S)\s*\(x?([0-9,]+)\)/m
const progressRE = /([0-9,]+)\s+\/\s+[0-9,]+\s+\([0-9.]+%\)/
const pastDateRE = /^\s+([A-Z][a-z][a-z])\s+(\d+)(?:st|nd|rd|th),\s+(\d\d\d\d)/m
const contributedRE = /^\s*You have contributed ([0-9,]+) item/m

const PHP_MONTHS = {
  "Jan": 1,
  "Feb": 2,
  "Mar": 3,
  "Apr": 4,
  "May": 5,
  "Jun": 6,
  "Jul": 7,
  "Aug": 8,
  "Sep": 9,
  "Oct": 10,
  "Nov": 11,
  "Dec": 12,
}

class CommunityCenter {
  constructor(data) {
      Object.assign(this, data)
  }
}

class CommunityCenterDB {
  constructor(db) {
      this.db = db
  }

  async learn(data) {
      if (!data.date) {
          throw "Date is required"
      }
      const tx = this.db.transaction("communityCenter", "readwrite")
      const existing = (await tx.store.get(data.date)) || {firstSeen: Date.now()}
      let change = false
      for (const key in data) {
          if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
              existing[key] = data[key]
              change = true
          }
      }
      if (change) {
          console.log(`CommunityCenterDB: Learning new data about ${data.date}: ${JSON.stringify(data)}`)
          await Promise.all([
              tx.store.put(existing),
              tx.done,
          ])
      }
  }

  /**
   * Fetch data for an emblem.
   * @param {string} date
   */
  async get(date) {
      return new CommunityCenter(await this.db.get("communityCenter", date))
  }
}



/**
 * Parse data from comm.php.
 * @param {Document} dom
 * @param {URL} url
 */
 const parseCommunityCenter = (dom, url) => {
  const today = luxon.DateTime.fromObject({}, {zone: "America/Chicago"}).toISODate()
  const comm = {missions: [], contributed: null, contributedDate: today}
  // Parse today's CC.
  const todayCard = findSection(dom, "Current Goal")
  const [goal, reward] = Array.from(todayCard.querySelectorAll(".col-50")).map(elm => {
    const match = elm.textContent.match(todayQuantityRE)
    return {
      item: match[1],
      quantity: parseInt(match[2].replace(/,/g, ""), 10),
    }
  })
  const progress = parseInt(todayCard.textContent.match(progressRE)[1].replace(/,/g, ""), 10)
  comm.missions.push({
    date: today,
    goalItem: goal.item,
    goalQuantity: goal.quantity,
    rewardItem: reward.item,
    rewardQuantity: reward.quantity,
    progress,
  })

  // And then the past days.
  const pastCard = findSection(dom, "Last 7 Days")
  for (const elm of pastCard.querySelectorAll("li")) {
    const text = elm.textContent
    const dateMatch = text.match(pastDateRE)
    const goalMatch = text.match(goalQuantityRE)
    const rewardMatch = text.match(rewardQuantityRE)
    const progressMatch = text.match(progressRE)
    comm.missions.push({
      date: `${dateMatch[3]}-${PHP_MONTHS[dateMatch[1]].toString().padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`,
      goalItem: goalMatch[1],
      goalQuantity: parseInt(goalMatch[2].replace(/,/g, ""), 10),
      rewardItem: rewardMatch[1],
      rewardQuantity: parseInt(rewardMatch[2].replace(/,/g, ""), 10),
      progress: parseInt(progressMatch[1].replace(/,/g, ""), 10),
    })
  }

  // Check today's contribution.
  const match = todayCard.textContent.match(contributedRE)
  if (match) {
    comm.contributed = parseInt(match[1].replace(/,/g, ""), 10)
  }

  return comm
}

/**
 * Process comm.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} url
 */
const visitCommunityCenter = async (state, dom, url) => {
  const comm = parseCommunityCenter(dom, url)
  for (const mission of comm.missions) {
    await state.communityCenter.learn(mission)
  }
  if (comm.contributed && state.player.communityCenterDate !== comm.contributedDate) {
    // Mark as having done the CC today.
    state.player.communityCenterDate = comm.contributedDate
    await state.player.save(state.db)
  }
}

/**
 * Set up the Community Center plugin.
 * @param {GlobalState} state
 */
export const setupCommunityCenter = state => {
  state.communityCenter = new CommunityCenterDB(state.db)
  state.addPageHandler("comm", visitCommunityCenter, {parse: true})
}

/**
 * Update community center data manually.
 * @param {GlobalState} state
 */
export const fetchCommunityCenter = async state => {
  await state.fetchPage("https://farmrpg.com/comm.php", visitCommunityCenter, {parse: true})
}
