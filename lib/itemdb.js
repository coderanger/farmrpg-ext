export default class ItemDB {
    constructor(db) {
        this.db = db
    }

    // Learn new data about an item.
    async learn(data) {
        if (!data.name) {
            throw "Name is required"
        }
        const tx = this.db.transaction("items", "readwrite")
        const existing = (await tx.store.get(data.name)) || {}
        let change = false
        for (const key in data) {
            if (key === "quantity") {
                continue
            }
            if (data[key] !== existing[key]) {
                existing[key] = data[key]
                change = true
            }
        }
        if (change) {
            console.log(`ItemDB: Learning new data about ${data.name}: ${JSON.stringify(data)}`)
            await Promise.all([
                tx.store.put(existing),
                tx.done,
            ])
        }
    }

    // Forget about an item. Mostly for debugging.
    async forget(name) {
        await this.db.delete("items", name)
    }

    // Fetch data for an item.
    async get(name) {
        return await this.db.get("items", name)
    }

    // Fetch data by the image URL.
    async getByImage(image) {
        return await this.db.getAllFromIndex("items", "byImage", image)
    }

    // Fetch data by the item ID.
    async getByID(id) {
        return await this.db.getFromIndex("items", "byID", id)
    }
}
