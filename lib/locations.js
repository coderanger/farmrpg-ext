import { setupPageFilter } from './pageFilter.js'

export class LocationDB {
    constructor(db) {
        this.db = db
    }

    async learn(data) {
        if (!data.name) {
            throw "Name is required"
        }
        if (!data.type) {
            throw "Type is required"
        }
        await this.db.put("locations", data)
    }

    // Fetch data for a zone.
    async get(type, name) {
        return await this.db.get("locations", [type, name])
    }

    // Fetch data by the zone ID.
    async getByID(type, id) {
        return await this.db.getFromIndex("locations", "byID", [type, id])
    }
}

const parseLocationInfo = (page, url) => {
    // <div class="col-25"><a href='item.php?id=35'><img src='/img/items/6143.PNG' class='itemimg'></a><br/>Wood<br/><span style='font-size:11px; '>802 / 1338</span></div>
    const loc = {items: []}
    // Parse the ID and type out of the URL.
    const parsedUrl = new URL(url)
    loc.id = parsedUrl.searchParams.get("id")
    loc.type = parsedUrl.searchParams.get("type")
    // Parse the name and items from the HTML.
    const parser = new DOMParser()
    const dom = parser.parseFromString(page, "text/html")
    loc.name = dom.querySelector(".center.sliding").innerText
    for (const elm of dom.querySelectorAll("img.itemimg")) {
        if (elm.parentElement.nodeName !== "A") {
            // This is probably the SE face image down below.
            continue
        }
        const text = elm.parentElement.nextSibling.nextSibling
        if (text.nodeName !== "#text") {
            throw `Error parsing item name from zone info: ${text.nodeName}`
        }
        loc.items.push(text.nodeValue)
    }
    return loc
}

const visitLocationInfo = async (state, page, url) => {
    const zone = parseLocationInfo(page, url)
    await state.locations.learn(zone)
}

export const setupLocations = state => {
    state.locations = new LocationDB(state.db)
    setupPageFilter("https://farmrpg.com/location.php?*", async (page, url) => {
        await visitLocationInfo(state, page, url)
    })
}
