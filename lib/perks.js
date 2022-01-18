import { setupPageFilter } from './pageFilter.js'
import { renderSidebar } from './sidebar.js'

const parsePerks = (page, url) => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    // Parse out available perksets and which is active (if any).
    let perksetsElm = null
    for (const row of dom.querySelectorAll(".content-block-title")) {
        if (row.textContent.trim() === "My Perk Sets") {
            perksetsElm = row.nextElementSibling
            break
        }
    }
    if (perksetsElm === null) {
        // Non-beta/alpha user, leave the system disabled.
        return {perksets: null, currentPerkset: null}
    }
    const perksets = {}
    let currentPerkset = null
    for (const row of perksetsElm.querySelectorAll(".item-title")) {
        const name = row.textContent.trim()
        const isCurrent = (row.getAttribute("style") || "").includes("bold")
        const id = row.parentElement.querySelector(".activateperksetbtn").dataset.id
        perksets[name] = id
        if (isCurrent) {
            currentPerkset = name
        }
    }
    return {perksets, currentPerkset}
}

const visitPerks = async (state, page, url) => {
    const perks = parsePerks(page, url)
    state.player.perksets = perks.perksets
    state.player.currentPerkset = perks.currentPerkset
    await state.player.save(state.db)
    await renderSidebar(state)
}

const visitActivatePerkSet = async (state, page, url) => {
    // If we don't have any perksets, bail out.
    if (state.player.perksets === null) {
        return
    }
    // Parse the ID out of the URL.
    const parsedUrl = new URL(url)
    const id = parsedUrl.searchParams.get("id")
    for (const name in state.player.perksets) {
        if (state.player.perksets[name] === id) {
            state.player.currentPerkset = name
            await state.player.save(state.db)
            await renderSidebar(state)
            return
        }
    }
    console.log.error(`Unable to find perkset name for id ${id}`)
}


export const setupPerks = state => {
    setupPageFilter("https://farmrpg.com/perks.php", async (page, url) => {
        await visitPerks(state, page, url)
    })
    setupPageFilter("https://farmrpg.com/worker.php?go=activateperkset*", async (page, url) => {
        await visitActivatePerkSet(state, page, url)
    })
}

export const fetchPerks = async () => {
    const resp = await fetch("https://farmrpg.com/perks.php")
    if (!resp.ok) {
        throw "Error getting perks"
    }
    const page = await resp.text()
    return parsePerks(page, "https://farmrpg.com/perks.php")
}
