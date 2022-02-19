const petAboutRE = /^\s*About the (.*?)\s*$/
const petLevelRE = /Level (\d+)/

class Pet {
    constructor(data) {
        Object.assign(this, data)
    }

    itemsForLevel(level) {
        const items = []
        if (level >= 1) {
            items.push(...this.level1Items)
        }
        if (level >= 3) {
            items.push(...this.level3Items)
        }
        if (level >= 6) {
            items.push(...this.level6Items)
        }
        return items
    }
}

export class PetDB {
    constructor(db) {
        this.db = db
    }

    async learn(data) {
        if (!data.name) {
            throw "Name is required"
        }
        await this.db.put("pets", data)
    }

    // Fetch data for a pet.
    async get(name) {
        return new Pet(await this.db.get("pets", name))
    }

    // Fetch data by the pet ID.
    async getByID(id) {
        return new Pet(await this.db.getFromIndex("pets", "byID", id))
    }
}

const parsePetInfo = (page, url) => {
    const pet = {level1Items: [], level3Items: [], level6Items: []}
    // Get the ID from the URL.
    const parsedUrl = new URL(url)
    pet.id = parsedUrl.searchParams.get("id")
    // Everything else from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const img = dom.querySelector(".exploreimg")
    pet.image = img.getAttribute("src")
    pet.name = img.nextElementSibling.nextElementSibling.textContent.trim()
    for (const row of dom.querySelectorAll(".content-block-title")) {
        let items = null
        switch(row.textContent.trim()) {
        case "Level 1 Items":
            items = pet.level1Items
            break
        case "Level 3 Items":
            items = pet.level3Items
            break
        case "Level 6 Items":
            items = pet.level6Items
            break
        default:
            continue
        }
        for (const item of row.nextElementSibling.querySelectorAll(".col-25")) {
            const itemName = item.textContent.trim()
            if (itemName !== "-") {
                items.push(itemName)
            }
        }
    }
    return pet
}

const visitPetInfo = async (state, page, url) => {
    const pet = parsePetInfo(page, url)
    await state.pets.learn(pet)
    state.lastView = "pet"
    state.lastPet = pet.name
}

const parsePet = (page, url) => {
    const pet = {}
    // Get the ID from the URL.
    const parsedUrl = new URL(url)
    pet.id = parsedUrl.searchParams.get("id")
    // Everything else from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    const img = dom.querySelector(".exploreimg")
    pet.image = img.getAttribute("src")
    const title = dom.querySelector(".content-block-title").innerText
    const match = title.match(petAboutRE)
    if (!match) {
        throw `Unable to parse pet name from ${title}`
    }
    pet.name = match[1]
    return pet
}

const visitPet = async (state, page, url) => {
    const pet = parsePet(page, url)
    state.lastView = "pet"
    state.lastPet = pet.name
}

const parsePets = (page, url) => {
    const pets = {}
    // Find the levels of all pets.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    for (const img of dom.querySelectorAll("img.itemimg")) {
        const parent = img.parentElement
        if (parent.nodeName !== "A") {
            // It's one of the not-yet-purchased pets.
            continue
        }
        const linkUrl = new URL(parent.href)
        const match = parent.parentElement.innerText.match(petLevelRE)
        if (!match) {
            console.log("Unable to parse pet level from ", parent.parentElement.innerText)
            continue
        }
        pets[linkUrl.searchParams.get("id")] = parseInt(match[1], 10)
    }
    return pets
}

const visitPets = async (state, page, url) => {
    const petsByID = parsePets(page, url)
    const pets = {}
    for (const petID in petsByID) {
        const pet = await state.pets.getByID(petID)
        if (!pet) {
            throw `Unknown pet ID ${petID}`
        }
        pets[pet.name] = petsByID[petID]
    }
    state.player.pets = pets
    await state.player.save(state.db)
    state.lastView = "pets"
}

const visitAllPetItems = async (state, page, url) => {
    state.lastView = "pets"
}

export const setupPets = state => {
    state.pets = new PetDB(state.db)
    state.addPageHandler("petinfo", visitPetInfo)
    state.addPageHandler("pet", visitPet)
    state.addPageHandler("pets", visitPets)
    state.addPageHandler("allpetitems", visitAllPetItems)
    // Collect one
    // https://farmrpg.com/worker.php?go=collectpetitems&id=4
    // Collect all
    // https://farmrpg.com/worker.php?go=collectallpetitems
}
