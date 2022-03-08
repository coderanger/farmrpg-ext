import { findSection, parseNumberString } from "./utils.js"

class Quest {
    constructor(data) {
        Object.assign(this, data)
    }
}

class QuestDB {
    constructor(db) {
        this.db = db
    }

    async learn(data) {
        if (!data.id) {
            throw "ID is required"
        }
        const tx = this.db.transaction("quests", "readwrite")
        const existing = (await tx.store.get(data.id)) || {firstSeen: Date.now()}
        let change = false
        for (const key in data) {
            if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
                existing[key] = data[key]
                change = true
            }
        }
        if (change) {
            console.log(`QuestDB: Learning new data about ${data.id}: ${JSON.stringify(data)}`)
            await Promise.all([
                tx.store.put(existing),
                tx.done,
            ])
        }
    }

    /**
     * Fetch data for an item.
     * @param {string} id
     * @returns {Quest?}
     */
    async get(id) {
        const quest = await this.db.get("quests", id)
        return quest ? new Quest(quest) : quest
    }
}

/**
 * Try to parse a quest text block.
 * @param {string} text
 */
const parseQuestText = (text) => {
    // Oh god parsing this hurts.
    // First pull out the quest text, this is anything up to "Requires:",
    // "Available ...", "You completed this request!", or the end.
    let match = (text + "\n__END__").match(/^\s*(.*?)\s*(Requires:|Available ... \d|You completed this request!|__END__)/ms)
    if (!match) {
        // The whole thing is the text, no metadata. Bail out now.
        return {text: text.trim()}
    }
    const quest = {text: match[1]}
    // Look for level or availability metadata.
    match = text.match(/^\s*Farming Level (\d+)\s*$/i)
    if (match) {
        quest.requiresFarming = parseInt(match[1], 10)
    }
    match = text.match(/^\s*Crafting Level (\d+)\s*$/i)
    if (match) {
        quest.requiresCrafting = parseInt(match[1], 10)
    }
    match = text.match(/^\s*Fishing Level (\d+)\s*$/i)
    if (match) {
        quest.requiresFishing = parseInt(match[1], 10)
    }
    match = text.match(/^\s*Exploring Level (\d+)\s*$/i)
    if (match) {
        quest.requiresExploring = parseInt(match[1], 10)
    }
    // Look for availability. This is weird and bad because it doesn't include a year
    //  but I can probably fix that later by comparing the year the quest came out?
    match = text.match(/^\s*Available (\w+ \d+) - (\w+ \d+)/)
    if (match) {
        quest.availableFrom = match[1]
        quest.availableTo = match[2]
    }
    return quest
}

/**
 * Parse an item row.
 * @param {Element} row
 * @returns {{id: string, quantity: number} | null}
 */
const parseItemRow = (row) => {
    const link = row.querySelector("a")
    if (!link) {
        return null
    }
    const id = new URL(link.href).searchParams.get("id")
    const quantity = parseNumberString(row.querySelector(".item-after").textContent)
    return {id, quantity}
}

/**
 * Parse out quest data.
 * @param {Document} dom
 * @param {URL} parsedUrl
 */
const parseQuest = (dom, parsedUrl) => {
    const quest = {itemRequests: [], itemRewards: []}
    quest.id = parsedUrl.searchParams.get("id")
    quest.name = dom.querySelector(".center.sliding").innerText
    // The first card is the details.
    quest.from = dom.querySelector(".content-block-title").innerText.match(/Request from (.*?)\s*$/i)[1]
    const firstCard = dom.querySelector(".card-content-inner")
    quest.fromImage = firstCard.querySelector(".itemimg").getAttribute("src")
    Object.assign(quest, parseQuestText(firstCard.innerText))
    // Then the requests.
    const silverRequested = findSection(dom, "Silver Requested")
    if (silverRequested) {
        quest.silverRequest = parseInt(silverRequested.querySelector(".item-after").textContent.replace(/,/g, ""), 10)
    }
    const itemsRequested = findSection(dom, "Items Requested")
    if (itemsRequested) {
        for (const row of itemsRequested.querySelectorAll("li")) {
            quest.itemRequests.push(parseItemRow(row))
        }
    }
    // Finally the rewards.
    const rewards = findSection(dom, "Rewards")
    if (rewards) {
        for (const row of rewards.querySelectorAll("li")) {
            const item = parseItemRow(row)
            if (item) {
                quest.itemRewards.push(item)
            } else {
                // Silver or gold.
                const name = row.querySelector(".item-title").textContent.toLowerCase().trim()
                const quantity = parseNumberString(row.querySelector(".item-after").textContent)
                quest[`${name}Reward`] = quantity
            }
        }
    }
    return quest
}

/**
 * Visit quest.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} parsedUrl
 */
const visitQuest = async (state, dom, parsedUrl) => {
    const quest = parseQuest(dom, parsedUrl)
    await state.quests.learn(quest)
}

/**
 * Setup the quests module.
 * @param {GlobalState} state
 */
export const setupQuests = state => {
    state.quests = new QuestDB(state.db)
    state.fetchAllQuests = async (n, to=0) => fetchAllQuests(state, n, to)
    state.addPageHandler("quest", visitQuest, {parse: true})
}

/**
 * Force-update a quest.
 * @param {GlobalState} state
 * @param {string} id
 */
export const fetchQuest = async (state, id) => {
    const url = `https://farmrpg.com/quest.php?id=${id}`
    const resp = await fetch(url)
    if (!resp.ok) {
        throw `Error getting quest ${id}`
    }
    const page = await resp.text()
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    await visitQuest(state, dom, new URL(url))
}

/**
 * Force-update all quests up to a given ID.
 * @param {GlobalState} state
 * @param {number} n
 * @param {number} to
 */
export const fetchAllQuests = (state, n, to=0) => {
    if (state.runningFetchAllQuests) {
        return
    }
    console.log(`fetch-all-quests ${new Date().toISOString()} Fetching ${n-to} quests`)
    browser.alarms.create("fetch-all-quests", {periodInMinutes: 1/30})
    state.runningFetchAllQuests = true
    const fn = async alarm => {
        if (alarm.name === "fetch-all-quests") {
            console.log(`fetch-all-quests ${new Date().toISOString()} Fetching quest id=${n}`)
            try {
                if (n > 0) {
                    await fetchQuest(state, n.toString())
                }
            } catch(err) {
                console.log(`fetch-all-quests ${new Date().toISOString()} Error fetching quest id=${n}`, err)
            }
            n--
            if (n <= to) {
                browser.alarms.clear("fetch-all-quests")
                browser.alarms.onAlarm.removeListener(fn)
                state.runningFetchAllQuests = undefined
            }
        }
    }
    browser.alarms.onAlarm.addListener(fn)
}
