import { parseNumberString } from "./utils.js"
import { fetchInventory } from "./inventory.js"
import { REVERSE_NPCS } from "./npcFriendship.js"
/** @typedef {import("../farmrpg-ext-bg.js").GlobalState} GlobalState */

const durationRE = /^\s*(?:(\d+)d\s+)?(?:(\d+)h\s+)?(?:(\d+)m\s+)?base time/

class Item {
    constructor(data) {
        Object.assign(this, data)
    }
}

class ItemDB {
    constructor(db) {
        this.db = db
    }

    // Learn new data about an item.
    async learn(data) {
        if (!data.name && !data.id) {
            throw "Name or ID is required"
        }
        const tx = this.db.transaction("items", "readwrite")
        const existing = (await (data.id ? tx.store.get(data.id) : tx.store.getFromIndex("byName", data.name))) || {firstSeen: Date.now()}
        let change = false
        for (const key in data) {
            if (key === "quantity") {
                continue
            }
            if (JSON.stringify(data[key]) !== JSON.stringify(existing[key])) {
                existing[key] = data[key]
                change = true
            }
        }
        if (!existing.id) {
            // Unable to save the first time without an ID.
            console.error(`ItemDB: Can't learn about ${existing.name} without an ID`)
            return
        }
        if (change) {
            console.log(`ItemDB: Learning new data about ${existing.name}: ${JSON.stringify(data)}`)
            await Promise.all([
                tx.store.put(existing),
                tx.done,
            ])
        }
    }

    // Fetch data for an item.
    async get(name) {
        const item = await this.db.getFromIndex("items", "byName", name)
        return item ? new Item(item) : item
    }

    // Fetch data by the image URL.
    async getByImage(image) {
        const items = await this.db.getAllFromIndex("items", "byImage", image)
        return items.map(it => new Item(it))
    }

    // Fetch data by the item ID.
    async getByID(id) {
        const item = await this.db.get("items", id)
        return item ? new Item(item) : item
    }
}

// Parse a "1d 2h 3m base time" string to seconds.
const parseDuration = (str) => {
    const match = str.match(durationRE)
    if (match) {
        const days = parseInt(match[1] || "0", 10)
        const hours = parseInt(match[2] || "0", 10)
        const minutes = parseInt(match[3] || "0", 10)
        return ((((days * 24) + hours) * 60) + minutes) * 60
    } else {
        throw `Unable to parse duration from ${str}`
    }
}

/**
 * Parse out item.php data.
 * @param {Document} dom
 * @param {URL} parsedUrl
 */
const parseItemInfo = (dom, parsedUrl) => {
    const item = {}
    // Parse the ID out of the URL.
    item.id = parsedUrl.searchParams.get("id")
    // Parse whatever we can scavenge from the HTML starting with the name and image.
    item.name = dom.querySelector(".center.sliding").innerText.trim()
    item.image = dom.querySelector(".itemimglg").getAttribute("src")
    // Next parse the item details.
    let cardElm = dom.querySelector(".card") // Use the first card section by default but below this try to find the right one.
    for (const heading of dom.querySelectorAll(".content-block-title")) {
        if (heading.innerText === "Item Details") {
            cardElm = heading.nextElementSibling
            break
        }
    }
    for (const row of cardElm.querySelectorAll(".item-content")) {
        const key = row.querySelector(".item-title").childNodes[0].nodeValue.trim()
        if (key === "Mastery Progress") {
            item.mastery = true
            continue // For now, this breaks the following expression when the Claim Mastery button is present.
        }
        const value =  row.querySelector(".item-after")?.childNodes[0].nodeValue?.trim()
        switch (key) {
        case "Sell Price":
            item.sellPrice = parseNumberString(value)
            break
        case "Buy Price":
            item.buyPrice = parseNumberString(value)
            break
        case "XP Value":
            item.xp = parseNumberString(value)
            break
        case "Flea Market":
            item.fleaMarket = parseNumberString(value)
            break
        case "Rarity":
            item.rarity = value
            break
        case "Givable":
            item.givable = (value == "Yes")
            break
        case "Event Item":
            item.event = (value == "Yes")
            break
        case "Growth Time":
            item.growthTime = parseDuration(row.querySelector(".item-after").innerText)
            break
        case "Craftable":
            item.craftPrice = parseNumberString(value)
            break
        }
    }
    // Then look for a recipe section.
    let recipeElm = undefined
    for (const heading of dom.querySelectorAll(".content-block-title")) {
        if (heading.innerText === "Crafting Recipe") {
            recipeElm = heading.nextElementSibling.nextElementSibling
            break
        }
    }
    if (recipeElm) {
        item.recipe = []
        for (const row of recipeElm.querySelectorAll("li")) {
            const ingredientId = new URL(row.querySelector("a").href).searchParams.get("id")
            const ingredientName = row.querySelector(".item-title strong").textContent.trim()
            const ingredientCount = row.querySelector(".item-after").textContent.trim().slice(0, -1)
            item.recipe.push({id: ingredientId, name: ingredientName, quantity: parseNumberString(ingredientCount)})
        }
    }
    return item
}

/**
 * Visit item.php.
 * @param {GlobalState} state
 * @param {Document} dom
 * @param {URL} parsedUrl
 */
const visitItemInfo = async (state, dom, parsedUrl) => {
    const item = parseItemInfo(dom, parsedUrl)
    await state.items.learn(item)
}

const clickItem = async (state, eventType, eventArg, msg) => {
    const item = await state.items.get(eventArg)
    if (!item) {
        console.error(`Unknown item ${eventArg}`)
        return
    }

    const quickAction = state.player.quickActionFor(eventArg)
    if (quickAction !== undefined && !msg.shift) {
        const targetItem = quickAction.target === undefined ? item : await state.items.get(quickAction.target)
        const quantity = Math.min(Math.max((state.player.inventory[targetItem.name] || 1) - (state.player.maxInventory * (quickAction.keep || 0)), 0), state.player.maxInventory)
        console.log("running quick action", quickAction, quantity)
        if (quantity === 0) {
            // Not enough to process.
            return
        }
        // Run the quick action instead.
        switch (quickAction.action) {
            case "sell":
                await state.fetchPage(`https://farmrpg.com/worker.php?go=sellitem&id=${targetItem.id}&qty=${quantity}`, () => null, {method: "POST"})
                break
            case "mail":
                const npcId = REVERSE_NPCS[quickAction.arg]
                if (npcId === undefined) {
                    throw `Can't find NPC ${quickAction.arg}`
                }
                await state.fetchPage(`https://farmrpg.com/worker.php?go=givemailitem&id=${targetItem.id}&to=${npcId}&qty=${quantity}`, () => null, {method: "POST"})
                break
        }
        await state.fetchPage("https://farmrpg.com/workshop.php", () => null)
        await fetchInventory(state)
        return
    }

    // Default behavior is to open the item page.
    state.postMessage({ action: "RELOAD_VIEW", url: `item.php?id=${item.id}`})
}

/**
 * Setup the items module.
 * @param {GlobalState} state
 */
export const setupItems = state => {
    state.items = new ItemDB(state.db)
    state.addPageHandler("item", visitItemInfo, {parse: true})
    state.addClickHandler("item", clickItem)
    state.fetchAllItems = async (n, to=0) => fetchAllItems(state, n, to)
}

/**
 * Force-update an item.
 * @param {GlobalState} state
 * @param {string} id
 */
 export const fetchItem = async (state, id) => {
    const url = `https://farmrpg.com/item.php?id=${id}`
    const resp = await fetch(url)
    if (!resp.ok) {
        throw `Error getting item ${id}: ${resp.status}`
    }
    const page = await resp.text()
    if (page.trim() === "") {
        throw `Empty response for item ${id}`
    }
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    await visitItemInfo(state, dom, new URL(url))
}

/**
 * Force-update all items up to a given ID.
 * @param {GlobalState} state
 * @param {number} n
 * @param {number} to
 */
 export const fetchAllItems = (state, n, to=0) => {
    if (state.runningFetchAll) {
        return
    }
    console.log(`fetch-all-items ${new Date().toISOString()} Fetching ${n-to} items`)
    browser.alarms.create("fetch-all-items", {periodInMinutes: 1/30})
    state.runningFetchAll = true
    const fn = async alarm => {
        if (alarm.name === "fetch-all-items") {
            console.log(`fetch-all-items ${new Date().toISOString()} Fetching item id=${n}`)
            try {
                if (n > 0) {
                    await fetchItem(state, n.toString())
                }
            } catch(err) {
                console.log(`fetch-all-items ${new Date().toISOString()} Error fetching item id=${n}`, err)
            }
            n--
            if (n <= to) {
                browser.alarms.clear("fetch-all-items")
                browser.alarms.onAlarm.removeListener(fn)
                state.runningFetchAll = undefined
            }
        }
    }
    browser.alarms.onAlarm.addListener(fn)
}
