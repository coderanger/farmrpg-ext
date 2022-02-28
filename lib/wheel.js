// https://farmrpg.com/worker.php?go=spin&type=Random

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
        // Special case.
        if (spin.item === "Apples") {
            spin.item = "Apple"
        }
        spin.quantity = parseInt(match[2], 10)
    } else {
        // For now, in case of weirdness.
        console.error("no match on spin results", page)
        spin.raw = page
    }
    return spin
}

const visitSpinResult = async (state, page, url) => {
    const spin = parseSpin(page, url)
    if (spin.item) {
        state.player.inventory[spin.item] += spin.quantity
        if (state.player.inventory[spin.item] > state.player.maxInventory) {
            state.player.inventory[spin.item] = state.player.maxInventory
        }
        await state.player.save(state.db)
    }
    await state.log.spin(spin)
}

const visitSpin = async (state, page, url) => {
    state.lastView = "spin"
}

const segments = [
    'Apples',
    'Orange Juice',
    'Lemonade',
    'Fishing Nets',
    'Ancient Coins',
    'Gemstones',
    'Materials',
    'Random',
]

const parseSpinFirst = (page, url) => {
    const spin = {}
    // Pull the item info out the result.
    const [segment, results] = page.split("|", 2)
    spin.segment = segment
    spin.type = segments[parseInt(segment, 10) - 1]
    const match = results.match(spinResultsRE)
    if (match) {
        spin.item = match[1]
        // Special case.
        if (spin.item === "Apples") {
            spin.item = "Apple"
        }
        spin.quantity = parseInt(match[2], 10)
    } else {
        // For now, in case of weirdness.
        console.error("no match on spin results", page)
        spin.raw = results
    }
    return spin
}

const visitSpinFirst = async (state, page, url) => {
    const spin = parseSpinFirst(page, url)
    if (spin.item) {
        state.player.inventory[spin.item] += spin.quantity
        if (state.player.inventory[spin.item] > state.player.maxInventory) {
            state.player.inventory[spin.item] = state.player.maxInventory
        }
        await state.player.save(state.db)
    }
    await state.log.spin(spin)
}


export const setupWheel = state => {
    state.addWorkerHandler("spin", visitSpinResult)
    state.addWorkerHandler("spinfirst", visitSpinFirst)
    state.addPageHandler("spin", visitSpin)
}
