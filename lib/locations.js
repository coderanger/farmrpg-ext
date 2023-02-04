class Location {
    constructor(data) {
        Object.assign(this, data)
    }

    // Given a list of possible items, match it to one that this location actually actually has.
    matchItem(possibleItems, image) {
        // Try to map the image back to a specific item.
        if (possibleItems.length === 0) {
            // Must be something new, keep trying to parse the rest.
            console.error(`Location: No possible items for ${image}`)
            return null
        } else if (possibleItems.length === 1) {
            // Simple case, unique image.
            return possibleItems[0]
        } else {
            // The hard case, try to match against known drops in the zone.
            // If two drops in the zone use the same image, this will fail but what can I do?
            for (const possibleItem of possibleItems) {
                if (this.items.includes(possibleItem.name)) {
                    return possibleItem
                }
            }
            // No match, just pick the first in case this was an event drop of some kind and move on.
            console.warning(`Location: No match for item image ${image}, defaulting to ${possibleItems[0].name}`)
            return possibleItems[0]
        }
    }
}

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
        return new Location(await this.db.get("locations", [type, name]))
    }

    // Fetch data by the zone ID.
    async getByID(type, id) {
        return new Location(await this.db.getFromIndex("locations", "byID", [type, id]))
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
    loc.image = dom.querySelector(".exploreimg").getAttribute("src")
    for (const elm of dom.querySelectorAll("img.itemimg")) {
        if (elm.parentElement.nodeName !== "A") {
            // This is probably the SE face image down below.
            continue
        }
        const text = elm.parentElement.nextSibling.nextSibling
        if (text.nodeName !== "#text") {
            throw `Error parsing item name from zone info: ${text.nodeName}`
        }
        loc.items.push(text.nodeValue.trim())
    }
    return loc
}

const visitLocationInfo = async (state, page, url) => {
    const zone = parseLocationInfo(page, url)
    await state.locations.learn(zone)
}

export const setupLocations = state => {
    state.locations = new LocationDB(state.db)
    state.addPageHandler("location", visitLocationInfo)
}
