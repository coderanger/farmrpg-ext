const maxInventoryRE = /more than <strong>([0-9,]+)<\/strong> of any/
const itemLinkRE = /id=(\d+)/

const parseInventory = (page, url) => {
    // Parse out the max inventory size.
    const maxInvMatch = page.match(maxInventoryRE)
    if (!maxInvMatch) {
        throw "Error parsing max inventory"
    }
    const maxInv = parseInt(maxInvMatch[1].replaceAll(",", ""), 10)
    // Parse out all the items.
    const parser = new DOMParser()
    const invDom = parser.parseFromString(page, "text/html")
    const items = {}
    const quantities = {}
    for (const itemElm of invDom.querySelectorAll('.list-group li')) {
        // Ignore dividers.
        if (itemElm.classList.contains("item-divider")) {
            continue
        }

        const title = itemElm.querySelector(".item-title strong")
        if (!title) {
            console.log("Unable to parse item name from ", itemElm)
            continue
        }
        const after = itemElm.querySelector('.item-after')
        if (!after) {
            console.log("Unable to parse item quantity from ", itemElm)
            continue
        }
        const link = itemElm.querySelector("a.item-link")
        if (!link) {
            console.log("Unable to parse item ID from ", itemElm)
            continue
        }
        const linkMatch = link.getAttribute("href").match(itemLinkRE)
        if (!linkMatch) {
            console.log("Unable to parse item ID from link ", link.getAttribute("href"))
            continue
        }
        items[title.textContent] = {
            "name": title.textContent.trim(),
            "id": linkMatch[1],
            "image": itemElm.querySelector(".item-media img").getAttribute("src"),
        }
        quantities[title.textContent.trim()] = parseInt(after.textContent, 10)
    }
    return { "max": maxInv, items, quantities }
}

const visitInventory = async (state, page, url) => {
    const inv = parseInventory(page, url)
    for (const item in inv.items) {
        await state.items.learn(inv.items[item])
    }
    state.player.inventory = inv.quantities
    state.player.maxInventory = inv.max
    await state.player.save(state.db)
}

export const setupInventory = state => {
    state.addPageFilter("https://farmrpg.com/inventory.php", visitInventory)
}

export const fetchInventory = async state => {
    // Get the inventory HTML.
    const resp = await fetch("https://farmrpg.com/inventory.php")
    if (!resp.ok) {
        throw "Error getting inventory"
    }
    const page = await resp.text()
    await visitInventory(state, page, "https://farmrpg.com/inventory.php")
}
