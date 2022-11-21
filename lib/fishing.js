import { fetchInventory } from './inventory.js'

const largeNetQuantityRE = /\(x(\d+)\)/
const fishCaughtItemRE = /<br\/>([^<]*?)\s*($|<)/

// Large net:
// <br/><span style="font-size:11px"><img src='/img/items/coral.png' style='vertical-align:middle; width:18px'> (x34) &nbsp; <img src='/img/items/7878.png' style='vertical-align:middle; width:18px'> (x45) &nbsp; <img src='/img/items/4899.png' style='vertical-align:middle; width:18px'> (x110) &nbsp; <img src='/img/items/7477.png' style='vertical-align:middle; width:18px'> (x55) &nbsp; <img src='/img/items/7754.png' style='vertical-align:middle; width:18px'> (x49)<br/> &nbsp; <img src='/img/items/7817.png' style='vertical-align:middle; width:18px'> (x35) &nbsp; <img src='/img/items/7486.png' style='vertical-align:middle; width:18px'> (x72)</span><span style='display:none'>
// <div id="fishingpb">-598.93</div>
// <div id="netcnt">11</div>
// <div id="nettyp">Large Net</div>
// <div id="fishcnt">400</div>
// </span>

const parseNetResults = (page, url) => {
    const results = {items: [], largeNet: page.includes("(x")}
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    results.locID = parsedUrl.searchParams.get("id")
    // Parse the images out of the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    for (const image of dom.querySelectorAll("img")) {
        results.items.push({
            image: image.getAttribute("src"),
            overflow: (image.getAttribute("style") || "").includes("grayscale"),
            quantity: results.largeNet ? parseInt(image.nextSibling.nodeValue.match(largeNetQuantityRE)[1], 10) : 1
        })
    }
    return results
}

const visitNetResults = async (state, page, url) => {
    const results = parseNetResults(page, url)
    const loc = await state.locations.getByID("fishing", results.locID)
    if (!loc) {
        throw "Unknown fishing loc for results"
    }
    const items = []
    let xp = 0
    for (const item of results.items) {
        // Try to map the image back to a specific item.
        const possibleItems = await state.items.getByImage(item.image)
        const matchedItem = loc.matchItem(possibleItems, item.image)
        if (!matchedItem) {
            continue
        }
        // Update inventory if needed.
        state.player.inventory[matchedItem.name] = item.overflow ? state.player.maxInventory : ((state.player.inventory[matchedItem.name] || 0) + item.quantity)
        items.push({item: matchedItem.name, overflow: item.overflow, quantity: item.quantity})
        xp += ((matchedItem.xp || 0) * item.quantity)
    }
    await state.player.save(state.db)
    const action = results.largeNet ? "largeNet" : "net"
    const runecube = state.player.perks["Eagle Eye"] || false
    if (state.player.settings.drop_logging === "1") {
        await state.log[action]({location: loc.name, items, runecube})
    }
    if (state.player.settings.xp_logging) {
        console.debug("fishing xp from items", xp)
    }
}

const parseFishing = (page, url) => {
    const loc = {items: []}
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    loc.id = parsedUrl.searchParams.get("id")
    // Parse the name from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    loc.name = dom.querySelector(".center.sliding").childNodes[0].nodeValue.trim()
    return loc
}

const visitFishing = async (state, page, url) => {
    const loc = parseFishing(page, url)
    state.lastView = "location"
    state.lastLocationType = "fishing"
    state.lastLocation = loc.name
}

const visitSellAllUserFish = async (state, page, url) => {
    await fetchInventory(state)
}

const parseFishCaught = (page, url) => {
    const results = {}
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    results.locID = parsedUrl.searchParams.get("id")
    // Parse the item out of the page.
    const match = page.match(fishCaughtItemRE)
    if (!match) {
        throw `Unable to find item in fishcaught: ${page}`
    }
    results.item = match[1]
    results.overflow = page.includes("filter: grayscale")
    return results
}

const visitFishCaught = async (state, page, url) => {
    const results = parseFishCaught(page, url)
    const loc = await state.locations.getByID("fishing", results.locID)
    if (!loc) {
        throw `Unknown fishing loc for results: ${results.locID}`
    }
    // Update inventory.
    state.player.inventory[results.item] = results.overflow ? state.player.maxInventory : ((state.player.inventory[results.item] || 0) + 1)
    await state.player.save(state.db)
    const runecube = state.player.perks["Eagle Eye"] || false
    if (state.player.settings.drop_logging === "1") {
        await state.log.fish({location: loc.name, items: [
            {item: results.item, overflow: results.overflow, quantity: 1},
        ], runecube})
    }
}

export const setupFishing = state => {
    state.addWorkerHandler("castnet", visitNetResults)
    state.addPageHandler("fishing", visitFishing)
    state.addWorkerHandler("sellalluserfish", visitSellAllUserFish)
    state.addWorkerHandler("fishcaught", visitFishCaught)
}
