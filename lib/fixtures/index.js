import items from "./items.js"
import zones from "./zones.js"

const syncFixture = async (db, objectStore, fixture) => {
    const tx = db.transaction(objectStore, "readwrite")
    for (const data of fixture) {
        const existing = await tx.store.get(data[tx.store.keyPath])
        if (existing === undefined) {
            console.debug(`Fixtures: Adding ${objectStore} ${data[tx.store.keyPath]}`)
            await tx.store.add(data)
        }
    }
    await tx.done
}

export default async db => {
    await Promise.all([
        syncFixture(db, "items", items),
        syncFixture(db, "zones", zones),
    ])
}
