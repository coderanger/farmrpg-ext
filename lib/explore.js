import { setupPageFilter } from './pageFilter.js'
import { renderSidebar } from './sidebar.js'

const idRE = /id=(\d+)/
const numberRE = /^\d+$/

const parseExploreResults = (page, url) => {
    // Multi stam
    //   <br/>You continued and used <strong>24</strong> stamina<br/><img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/6005.png' style='width:24px;'> <img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/saltrock.png' style='width:24px;'> <img src='/img/items/5655.png' style='width:24px;'> <img src='/img/items/6695.png' style='width:24px;'> <img src='/img/items/ForestIcons_46_t.png' style='width:24px;'> <span style='display:none'>
    //   <div id="explorepb">78.31</div>
    //   <div id="explorestam">9</div>
    //   </span>
    // Single stam
    //   <img src='/img/items/ForestIcons_15_t.png' class='itemimg' ><br/>On the ground you find <strong>Thorns</strong>! It has been placed in your Inventory.<span style='display:none'>
    //   <div id="explorepb">78.32</div>
    //   <div id="explorestam">7</div>
    //   </span>
    // With overflow
    //   <br/>You continued and used <strong>24</strong> stamina<br/><img src='/img/items/5910.png' style='width:24px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'> <img src='/img/items/6143.PNG' style='width:24px;'> <img src='/img/items/6143.PNG' style='width:24px;'> <span style='display:none'>
    //   <div id="explorepb">78.32</div>
    //   <div id="explorestam">156</div>
    //   </span>
    // Lemonade
    //   Lemonade helped you find:<br/><strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/mushroom.png' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/5910.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/mushroom.png' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/5922.png' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/5908.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/5910.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong><br/> <strong><img src='/img/items/5908.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/5908.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong> <strong><img src='/img/items/5908.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/5908.png' style='width:25px;padding:2px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'></strong> <strong><img src='/img/items/6143.PNG' style='width:25px;padding:2px;'></strong><span style='display:none'>
    //   <div id="explorepb">1.76</div>
    //   <div id="explorestam">54</div>
    //   </span>
    const results = {items: []}
    const urlMatch = url.match(idRE)
    if (!urlMatch) {
        throw "Error parsing zone ID for results"
    }
    results.zoneID = urlMatch[1]
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    if (page.startsWith("Lemonade helped you find:")) {
        results.lemonade = true
    } else {
        results.stamina = 1 // Single explore as the default.
        const strong = dom.querySelector("strong")
        if (!strong) {
            // Single explore with no drops.
            return results
        }
        if (numberRE.test(strong.textContent)) {
            // Multi-explore.
            results.stamina = parseInt(strong.textContent, 10)
        }
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

const matchItemImage = async (state, image, zone) => {
    // Try to map the image back to a specific item.
    const possibleItems = await state.items.getByImage(image)
    if (possibleItems.length === 0) {
        // Must be something new, keep trying to parse the rest.
        console.error(`Explore: No items match image ${image}`)
        return null
    } else if (possibleItems.length === 1) {
        // Simple case, unique image.
        return possibleItems[0].name
    } else {
        // The hard case, try to match against known drops in the zone.
        // If two drops in the zone use the same image, this will fail but what can I do?
        for (const possibleItem of possibleItems) {
            if (zone.items.includes(possibleItem.name)) {
                return possibleItem.name
            }
        }
        // No match, just pick the first and move on.
        console.warning(`Explore: No match for item image ${image} in zone, defaulting to ${possibleItems[0].name}`)
        return possibleItems[0].name
    }
}

const visitExploreResults = async (state, page, url) => {
    const results = parseExploreResults(page, url)
    const zone = await state.locations.getByID("explore", results.zoneID)
    if (!zone) {
        throw "Unknown explore zone for results"
    }
    const items = []
    for (const item of results.items) {
        const itemName = await matchItemImage(state, item.image, zone)
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
        }
        items.push({item: itemName, overflow: item.overflow})
    }
    const logMethod = results.lemonade ? "lemonade" : "explore"
    return state.log[logMethod]({stamina: results.stamina, zone: zone.name, items})
}

export const setupExplore = state => {
    setupPageFilter("https://farmrpg.com/worker.php?go=explore&id=*", async (page, url) => {
        await visitExploreResults(state, page, url)
        await renderSidebar(state)
    })
    // Lemonade.
    setupPageFilter("https://farmrpg.com/worker.php?go=drinklm&id=*", async (page, url) => {
        await visitExploreResults(state, page, url)
        await renderSidebar(state)
    })
}
