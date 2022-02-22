import items from "./items.js"
import locations from "./locations.js"
import pets from "./pets.js"

const keyFor = (keyPath, data) => {
    if (keyPath instanceof Array) {
        return keyPath.map(k => keyFor(k, data))
    } else{
        return data[keyPath]
    }
}

const syncFixture = async (db, objectStore, fixture) => {
    const tx = db.transaction(objectStore, "readwrite")
    for (const data of fixture) {
        const key = keyFor(tx.store.keyPath, data)
        const existing = await tx.store.get(key)
        if (existing === undefined) {
            console.debug(`Fixtures: Adding ${objectStore} ${key}`)
            await tx.store.add(data)
        } else {
            // Check for completely new fields but don't overwrite existing data.
            let change = false
            for (const k in data) {
                if (existing[k] === undefined) {
                    existing[k] = data[k]
                    change = true
                }
            }
            if (change) {
                console.debug(`Fixtures: Updating ${objectStore} ${key}`)
                await tx.store.put(existing)
            }
        }
    }
    await tx.done
}

export default async db => {
    await Promise.all([
        syncFixture(db, "items", items),
        syncFixture(db, "locations", locations),
        syncFixture(db, "pets", pets),
    ])
}
