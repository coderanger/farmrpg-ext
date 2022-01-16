import { fetchInventory } from './inventory.js'
import { setupPageFilter } from './pageFilter.js'
import { renderSidebar } from './sidebar.js'

const parseNetResults = (page, url) => {
    const results = {items: []}
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
    for (const item of results.items) {
        // Try to map the image back to a specific item.
        const possibleItems = await state.items.getByImage(item.image)
        const itemName = loc.matchItem(possibleItems, item.image)
        if (!itemName) {
            continue
        }
        // Update inventory if needed.
        if (state.inventory.items[itemName]) {
            const invItem = state.inventory.items[itemName]
            if (item.overflow) {
                invItem.quantity = state.inventory.max
            } else {
                invItem.quantity += 1
            }
        } else {
            state.inventory.items[itemName] = {name: itemName, quantity: 1}
        }
        items.push({item: itemName, overflow: item.overflow})
    }
    return state.log.net({location: loc.name, items})
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

export const setupFishing = state => {
    setupPageFilter("https://farmrpg.com/worker.php?go=castnet&id=*", async (page, url) => {
        await visitNetResults(state, page, url)
        await renderSidebar(state)
    })
    setupPageFilter("https://farmrpg.com/fishing.php?*", async (page, url) => {
        await visitFishing(state, page, url)
        await renderSidebar(state)
    })
    setupPageFilter("https://farmrpg.com/worker.php?go=sellalluserfish", async (page, url) => {
        state.inventory = await fetchInventory()
        await renderSidebar(state)
    })
}
