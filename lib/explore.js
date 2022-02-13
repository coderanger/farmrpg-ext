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
    // Cider
    // https://farmrpg.com/worker.php?go=explore&id=7&cider=1
    // You explored <strong>1000x</strong> and used <strong>663</strong> stamina<br/><strong>304</strong> items found!<br/><span style='font-size:11px'><img src='/img/items/6143.PNG' style='vertical-align:middle; width:18px'> (x131) &nbsp;<img src='/img/items/mushroom.png' style='vertical-align:middle; width:18px'> (x56) &nbsp;<img src='/img/items/5986.PNG' style='vertical-align:middle; width:18px'> (x37) &nbsp;<img src='/img/items/5908.png' style='vertical-align:middle; width:18px'> (x54) &nbsp;<img src='/img/items/5922.png' style='vertical-align:middle; width:18px'> (x25)<br/> &nbsp;<img src='/img/items/fireant.png' style='vertical-align:middle; width:18px'> (x1) &nbsp;<img src='/img/items/6067.PNG' style='vertical-align:middle;width:18px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'> (x0) &nbsp;<img src='/img/items/5910.png' style='vertical-align:middle;width:18px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'> (x0) &nbsp;<img src='/img/items/fireant.png' style='vertical-align:middle;width:18px;border:1px solid gray; opacity:0.5; border-radius:5px; filter: grayscale(100%);'> (x0)</span><span style='display:none'>
    //           <div id="explorepb">-8.79</div>
    //           <div id="explorestam">1,152</div>
    //         </span>
    const results = {items: []}
    const parsedUrl = new URL(url)
    results.locID = parsedUrl.searchParams.get("id")
    results.cider = parsedUrl.searchParams.get("cider") === "1"
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    if (results.cider) {
        // Parse cider results which work diffently from the other two.
        const headerMatch = page.match(/explored <strong>(\d+)x<\/strong>.*<strong>(\d+)<\/strong>\s+stamina.*<strong>(\d+)<\/strong>\s+items\s+found/)
        if (!headerMatch) {
            throw "Unable to parse stamina from cider results"
        }
        results.explores = parseInt(headerMatch[1], 10)
        results.stamina = parseInt(headerMatch[2], 10)
        // We don't need it per se but useful for verification of the per-item parsing
        results.totalItems = parseInt(headerMatch[3], 10)
    } else if (page.startsWith("Lemonade helped you find:")) {
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
        let quantity = 1
        if (results.cider) {
            // For cider we need to pull the (xN) after the image.
            const text = image.nextSibling
            if (text.nodeName !== "#text") {
                console.error("error parsing cider item quantity, got next element", text)
                continue
            }
            const quantityMatch = text.nodeValue.match(/\(x(\d+)\)/)
            if (!quantityMatch) {
                console.error("error parsing cider item quantity, no match", text)
                continue
            }
            quantity = parseInt(quantityMatch[1], 10)
        }
        results.items.push({
            image: image.getAttribute("src"),
            quantity: quantity,
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
    // let xp = 0
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
        // xp += ((matchedItem.xp || 0) * item.quantity)
    }
    await state.player.save(state.db)
    const logMethod = results.lemonade ? "lemonade" : results.cider ? "cider" : "explore"
    await state.log[logMethod]({stamina: results.stamina, location: loc.name, items})
    // console.debug("exploring xp from items", xp)
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
    state.addPageFilter("https://farmrpg.com/worker.php?go=explore&id=*", visitExploreResults)
    // Lemonade.
    state.addPageFilter("https://farmrpg.com/worker.php?go=drinklm&id=*", visitExploreResults)
    state.addPageFilter("https://farmrpg.com/area.php?*", visitArea)
    // https://farmrpg.com/worker.php?go=eatxapples&amt=10&id=10
    // https://farmrpg.com/worker.php?go=eatxapples&amt=100&id=10
    // https://farmrpg.com/worker.php?go=eatapples&id=10
    // https://farmrpg.com/worker.php?go=drinkxojs&amt=10&id=10
    // https://farmrpg.com/worker.php?go=drinkojs&id=10
}



