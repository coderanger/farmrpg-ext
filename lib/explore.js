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
        throw "Error parsing loc ID for results"
    }
    results.locID = urlMatch[1]
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

const visitExploreResults = async (state, page, url) => {
    const results = parseExploreResults(page, url)
    const loc = await state.locations.getByID("explore", results.locID)
    if (!loc) {
        throw "Unknown explore loc for results"
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
    const logMethod = results.lemonade ? "lemonade" : "explore"
    return state.log[logMethod]({stamina: results.stamina, location: loc.name, items})
}

const parseArea = (page, url) => {
    const loc = {items: []}
    // Parse the ID and type out of the URL.
    const parsedUrl = new URL(url)
    loc.id = parsedUrl.searchParams.get("id")
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    loc.name = dom.querySelector(".center.sliding").childNodes[0].nodeValue.trim()
    return loc
}

const visitArea = async (state, page, url) => {
    const loc = parseArea(page, url)
    state.lastView = "location"
    state.lastLocationType = "explore"
    state.lastLocation = loc.name

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
    setupPageFilter("https://farmrpg.com/area.php?*", async (page, url) => {
        await visitArea(state, page, url)
        await renderSidebar(state)
    })
}
