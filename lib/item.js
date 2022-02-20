const numberRE = /^([0-9,]+)/
const durationRE = /^(?:(\d+)d\s+)?(?:(\d+)h\s+)?(?:(\d+)m\s+)?base time/

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
        if (!data.name) {
            throw "Name is required"
        }
        const tx = this.db.transaction("items", "readwrite")
        const existing = (await tx.store.get(data.name)) || {firstSeen: Date.now()}
        let change = false
        for (const key in data) {
            if (key === "quantity") {
                continue
            }
            if (data[key] !== existing[key]) {
                existing[key] = data[key]
                change = true
            }
        }
        if (change) {
            console.log(`ItemDB: Learning new data about ${data.name}: ${JSON.stringify(data)}`)
            await Promise.all([
                tx.store.put(existing),
                tx.done,
            ])
        }
    }

    // Fetch data for an item.
    async get(name) {
        const item = await this.db.get("items", name)
        return item ? new Item(item) : item
    }

    // Fetch data by the image URL.
    async getByImage(image) {
        const items = await this.db.getAllFromIndex("items", "byImage", image)
        return items.map(it => new Item(it))
    }

    // Fetch data by the item ID.
    async getByID(id) {
        const item = await this.db.getFromIndex("items", "byID", id)
        return item ? new Item(item) : item
    }
}

const parseNumberString = (str) => {
    const match = str.match(numberRE)
    if (match) {
        return parseInt(match[1].replace(/,/g, ""), 10)
    } else {
        throw `Unable to parse number from ${str}`
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

const parseItemInfo = (page, url) => {
    const item = {}
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    item.id = parsedUrl.searchParams.get("id")
    // Parse whatever we can scavenge from the HTML starting with the name and image.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
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
        const value = row.querySelector(".item-after").childNodes[0].nodeValue.trim()
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
            item.growthTime = parseDuration(value)
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
        item.recipe = {}
        for (const row of recipeElm.querySelectorAll(".item-content")) {
            const ingredientName = row.querySelector(".item-title strong").textContent.trim()
            const ingredientCount = row.querySelector(".item-after").textContent.trim().slice(0, -1)
            item.recipe[ingredientName] = parseInt(ingredientCount, 10)
        }
    }
    return item
}

const visitItemInfo = async (state, page, url) => {
    const item = parseItemInfo(page, url)
    await state.items.learn(item)
}

const clickItem = async (state, eventType, eventArg) => {
    const item = await state.items.get(eventArg)
    if (item) {
        state.postMessage({ action: "RELOAD_VIEW", url: `item.php?id=${item.id}`})
    } else {
        console.error(`Unknown item ${eventArg}`)
    }
}

export const setupItems = state => {
    state.items = new ItemDB(state.db)
    state.addPageHandler("item", visitItemInfo)
    state.addClickHandler("item", clickItem)
}
