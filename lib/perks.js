import { renderSidebar } from "./sidebar.js"

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
            return
        }
    }
    console.log.error(`Unable to find perkset name for id ${id}`)
}

const nextPerkset = state => {
    // Make a list of perksets in a stable order. The game does this in alphabetical order so I will to0 I guess.
    const perksets = Object.keys(state.player.perksets)
    if (perksets.length <= 1) {
        // The button should be hidden but just in case.
        console.error("Can't find next perkset without two or more")
        return null
    }
    perksets.sort()
    // Find the index of the current one, if not found we start at -1 so the first perkset will be next.
    const currentIndex = perksets.indexOf(state.player.currentPerkset)
    // Find the next enabled index.
    for (let i = 1; i < perksets.length; i++) {
        const candidate = perksets[(currentIndex + i) % perksets.length]
        const candidateID = state.player.perksets[candidate]
        if (state.player.settings[`perkset_${candidateID}`] === "1") {
            return {name: candidate, id: candidateID}
        }
    }
    // Something went wrong?
    console.error(`Unable to find next perkset from ${state.player.currentPerkset} (${currentIndex})`)
    return null
}

const clickPerk = async state => {
    state.perksetLoading = true
    await renderSidebar(state)
    const next = nextPerkset(state)
    if (next === null) {
        throw "Cannot find next perkset"
    }
    if (!next.id) {
        throw `Cannot find perkset ID for ${next.name}`
    }
    let resp = await fetch("https://farmrpg.com/worker.php?go=resetperks", {method: "POST"})
    if (!resp.ok) {
        throw "Error resetting perks"
    }
    resp = await fetch(`https://farmrpg.com/worker.php?go=activateperkset&id=${next.id}`, {method: "POST"})
    if (!resp.ok) {
        throw "Error activating perkset"
    }
    state.player.currentPerkset = next.name
    await state.player.save(state.db)
    state.perksetLoading = false
    await renderSidebar(state)
}


export const setupPerks = state => {
    state.addPageHandler("perks", visitPerks)
    state.addWorkerHandler("activateperkset", visitActivatePerkSet)
    state.addClickHandler("perk", clickPerk)
}

export const fetchPerks = async () => {
    const resp = await fetch("https://farmrpg.com/perks.php")
    if (!resp.ok) {
        throw "Error getting perks"
    }
    const page = await resp.text()
    return parsePerks(page, "https://farmrpg.com/perks.php")
}
