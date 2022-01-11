import items from "./items.js"
import locations from "./locations.js"

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
        }
    }
    await tx.done
}

export default async db => {
    await Promise.all([
        syncFixture(db, "items", items),
        syncFixture(db, "locations", locations),
    ])
}
