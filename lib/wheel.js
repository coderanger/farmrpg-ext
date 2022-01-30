// https://farmrpg.com/worker.php?go=spin&type=Random

import { renderSidebar } from "./sidebar.js"

// You got:<br/><img src='/img/items/5782.PNG' class='itemimg'><br/>Unpolished Shimmer Stone (x14)
const spinResultsRE = /([a-zA-Z0-9 ]+?)\s*\(x(\d+)\)/

const parseSpin = (page, url) => {
    const spin = {}
    // Parse the result type out of the URL.
    const parsedUrl = new URL(url)
    spin.type = parsedUrl.searchParams.get("type")
    // Pull the item info out the result.
    const match = page.match(spinResultsRE)
    if (match) {
        spin.item = match[1]
        spin.quantity = parseInt(match[2], 10)
    } else {
        // For now, in case of weirdness.
        spin.raw = page
    }
    return spin
}

const visitSpinResult = async (state, page, url) => {
    const spin = parseSpin(page, url)
    if (spin.item) {
        state.inventory.items[spin.item] += spin.quantity
        if (state.inventory.items[spin.item] > state.inventory.max) {
            state.inventory.items[spin.item] = state.inventory.max
        }
    }
    await state.log.spin(spin)
}

const visitSpin = async (state, page, url) => {
    state.lastView = "spin"
    renderSidebar(state)
}

export const setupWheel = state => {
    state.addPageFilter("https://farmrpg.com/worker.php?go=spin&*", visitSpinResult)
    state.addPageFilter("https://farmrpg.com/spin.php", visitSpin)
}
