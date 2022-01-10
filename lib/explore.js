import { setupPageFilter } from './pageFilter.js'
import { renderSidebar } from './sidebar.js'

const idRE = /id=(\d+)/
const numberRE = /^\d+$/

class ZoneDB {
    constructor(db) {
        this.db = db
    }

    async learn(data) {
        if (!data.name) {
            throw "Name is required"
        }
        await this.db.put("zones", data)
    }

    // Fetch data for a zone.
    async get(name) {
        return await this.db.get("zones", name)
    }

    // Fetch data by the zone ID.
    async getByID(id) {
        return await this.db.getFromIndex("zones", "byID", id)
    }
}

const parseExploreZoneInfo = (page, url) => {
    // <div class="col-25"><a href='item.php?id=35'><img src='/img/items/6143.PNG' class='itemimg'></a><br/>Wood<br/><span style='font-size:11px; '>802 / 1338</span></div>
    const zone = {items: []}
    // Parse the ID out of the URL.
    const urlMatch = url.match(idRE)
    if (!urlMatch) {
        throw "Error parsing ID for zone"
    }
    zone.id = urlMatch[1]
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    zone.name = dom.querySelector(".center.sliding").innerText
    for (const elm of dom.querySelectorAll("img.itemimg")) {
        if (elm.parentElement.nodeName !== "A") {
            // This is probably the SE face image down below.
            continue
        }
        const text = elm.parentElement.nextSibling.nextSibling
        if (text.nodeName !== "#text") {
            throw `Error parsing item name from zone info: ${text.nodeName}`
        }
        zone.items.push(text.nodeValue)
    }
    return zone
}

const parseExploreResults = (page, url) => {
    // Multi stam
    // <br/>You continued and used <strong>24</strong> stamina<br/><img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/6005.png' style='width:24px;'> <img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/saltrock.png' style='width:24px;'> <img src='/img/items/5655.png' style='width:24px;'> <img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/ForestIcons_46_t.png' style='width:24px;'> <span style='display:none'>
    // <div id="explorepb">78.31</div>
    // <div id="explorestam">9</div>
    // </span>
    // Single stam
    // <img src='/img/items/ForestIcons_15_t.png' class='itemimg' ><br/>On the ground you find <strong>Thorns</strong>! It has been placed in your Inventory.<span style='display:none'>
    // <div id="explorepb">78.32</div>
    // <div id="explorestam">7</div>
    // </span>
    // With overflow
    // <br/>You continued and used <strong>24</strong> stamina<br/><img src='/img/items/5910.png' style='width:24px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'> <img src='/img/items/6143.PNG' style='width:24px;'> <img src='/img/items/6143.PNG' style='width:24px;'> <span style='display:none'>
    // <div id="explorepb">78.32</div>
    // <div id="explorestam">156</div>
    // </span>
    const results = {stamina: 1, items: []}
    const urlMatch = url.match(idRE)
    if (!urlMatch) {
        throw "Error parsing zone ID for results"
    }
    results.zoneID = urlMatch[1]
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const strong = dom.querySelector("strong")
    if (!strong) {
        // Single explore with no drops.
        return results
    }
    if (numberRE.test(strong.textContent)) {
        // Multi-explore.
        results.stamina = parseInt(strong.textContent, 10)
    }
    for (const image of dom.querySelectorAll("img")) {
        results.items.push({
            image: image.getAttribute("src"),
            // Single explore non-overflow has no style attribute.
            overflow: (image.getAttribute("style") || "").includes("grayscale"),
        })
    }
    return results
}

const visitExploreZoneInfo = async (state, page, url) => {
    const zone = parseExploreZoneInfo(page, url)
    await state.zones.learn(zone)
}

const visitExploreResults = async (state, page, url) => {
    const results = parseExploreResults(page, url)
    const zone = await state.zones.getByID(results.zoneID)
    if (!zone) {
        throw "Unknown explore zone for results"
    }
    const items = []
    for (const item of results.items) {
        // Try to map the image back to a specific item.
        let itemName
        const possibleItems = await state.items.getByImage(item.image)
        if (possibleItems.length === 0) {
            // Must be something new, keep trying to parse the rest.
            console.error(`Explore: No items match image ${item.images}`)
            continue
        } else if (possibleItems.length === 1) {
            // Simple case, unique image.
            itemName = possibleItems[0].name
        } else {
            // The hard case, try to match against known drops in the zone.
            // If two drops in the zone use the same image, this will fail but what can I do?
            for (const possibleItem of possibleItems) {
                if (zone.items.includes(possibleItem.name)) {
                    itemName = possibleItem.name
                    break
                }
            }
            if (itemName === undefined) {
                // No match, just pick the first and move on.
                console.warning(`Explore: No match for item image ${item.image} in zone, defaulting to ${possibleItems[0].name}`)
                itemName = possibleItems[0].name
            }
        }
        // Update inventory if needed.
        if (state.inventory.items[itemName]) {
            const invItem = state.inventory.items[itemName]
            if (item.overflow) {
                invItem.quantity = state.inventory.max
            } else {
                invItem.quantity += 1
            }
        }
        // Add to the list.
        items.push({item: itemName, overflow: item.overflow})
    }
    state.log.explore({stamina: results.stamina, zone: zone.name, items})
}

export const setupExplore = state => {
    state.zones = new ZoneDB(state.db)
    setupPageFilter("https://farmrpg.com/location.php?type=explore&id=*", async (page, url) => {
        await visitExploreZoneInfo(state, page, url)
    })
    setupPageFilter("https://farmrpg.com/worker.php?go=explore&id=*", async (page, url) => {
        await visitExploreResults(state, page, url)
        await renderSidebar(state)
    })
}
