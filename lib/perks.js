import { renderSidebar } from "./sidebar.js"
import { findSection, findAllSections } from "./utils.js"

const skillRE = /(farm)|(fish)|(craft)|(explor)/i

// Parse a list of perks from either the parks page or farm supply page.
const parsePerkList = (dom, farmSupply) => {
    const ignoreSections = farmSupply ? {"About Farm Supply": true, "Cap Upgrades": true} : {"Save Perk Set": true, "My Perk Sets": true}
    const perks = {}
    for (const [sectionTitle, sectionElm] of findAllSections(dom)) {
        if (ignoreSections[sectionTitle]) {
            continue
        }
        for (const row of sectionElm.querySelectorAll(".item-content")) {
            const name = row.querySelector(".item-title strong").innerText
            const active = row.querySelector("button.btnblue") !== null
            perks[name] = active
        }
    }
    return perks
}

const parsePerks = (page, url) => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    // Parse out available perksets and which is active (if any).
    const perks = parsePerkList(dom, false)
    let perksetsElm = findSection(dom, "My Perk Sets")
    if (perksetsElm === null) {
        // Non-beta/alpha user, leave the system disabled.
        return {perksets: null, currentPerkset: null, perks}
    }
    const perksets = {}
    let currentPerkset = null
    for (const row of perksetsElm.querySelectorAll(".item-title")) {
        const name = row.textContent.trim()
        const isCurrent = (row.getAttribute("style") || "").includes("bold")
        const id = row.parentElement.querySelector(".activateperksetbtn").dataset.id
        perksets[name] = {name, id}
        if (isCurrent) {
            currentPerkset = name
        }
    }
    return {perksets, currentPerkset, perks}
}

export const imageForPerkset = async (state, name) => {
    const skillMatch = name.match(skillRE)
    if (skillMatch) {
        // Some kind of skill name.
        if (skillMatch[1]) {
            // Farming.
            return "/img/items/6137.png?1"
        } else if (skillMatch[2]) {
            // Fishing.
            return  "/img/items/7783.png"
        } else if (skillMatch[3]) {
            // Crafting
            return "/img/items/5868.png"
        } else if (skillMatch[4]) {
            // Exploring.
            return "/img/items/6075.png"
        }
    }
    // Check if it's an item name.
    const item = await state.items.get(name)
    if (item) {
        return item.image
    }
    // Use the first letter.
    const firstLetter = name[0].toLowerCase()
    return browser.runtime.getURL(`images/letters/${firstLetter}.png`)
}

const visitPerks = async (state, page, url) => {
    const perks = parsePerks(page, url)
    for (const name in perks.perksets) {
        perks.perksets[name].image = await imageForPerkset(state, name, perks.perksets[name].id)
    }
    state.player.perks = perks.perks
    state.player.perksets = perks.perksets
    state.player.currentPerkset = perks.currentPerkset
    if (perks.currentPerkset !== null) {
        state.player.perksByPerkset[perks.currentPerkset] = perks.perks
    }
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
        if (state.player.perksets[name].id === id) {
            state.player.currentPerkset = name
            state.player.perks = state.player.perksByPerkset[name] || {}
            await state.player.save(state.db)
            return
        }
    }
    console.error(`Unable to find perkset name for id ${id}`)
}

const nextPerkset = state => {
    // Make a list of perksets in a stable order. The game does this in alphabetical order so I will too I guess.
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
    for (let i = 1; i <= perksets.length; i++) {
        const candidate = perksets[(currentIndex + i) % perksets.length]
        const candidateID = state.player.perksets[candidate].id
        if (state.player.settings[`perkset_${candidateID}`] === "1") {
            return {name: candidate, id: candidateID}
        }
    }
    // None enabled, just move to the next in the list.
    const candidate = perksets[(currentIndex + 1) % perksets.length]
    const candidateID = state.player.perksets[candidate].id
    return {name: candidate, id: candidateID}
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
    state.player.perks = state.player.perksByPerkset[next.name] || {}
    await state.player.save(state.db)
    state.perksetLoading = false
    await renderSidebar(state)
}

const parseFarmSupply = (page, url, parsedUrl) => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    return parsePerkList(dom, true)
}

const visitFarmSupply = async (state, page, url, parsedUrl) => {
    const perks = parseFarmSupply(page, url, parsedUrl)
    console.debug("farmSupply", perks)
    if (perks !== null) {
        state.player.farmSupply = perks
        await state.player.save(state.db)
    }
}

export const setupPerks = state => {
    state.addPageHandler("perks", visitPerks)
    state.addWorkerHandler("activateperkset", visitActivatePerkSet)
    state.addClickHandler("perk", clickPerk)
    state.addPageHandler("supply", visitFarmSupply)
}

export const fetchPerks = async state => {
    const resp = await fetch("https://farmrpg.com/perks.php")
    if (!resp.ok) {
        throw "Error getting perks"
    }
    const page = await resp.text()
    await visitPerks(state, page, "https://farmrpg.com/perks.php")
}
