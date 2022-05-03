const keyFor = (keyPath, data) => {
    if (keyPath instanceof Array) {
        return keyPath.map(k => keyFor(k, data))
    } else{
        return data[keyPath]
    }
}

const syncFixture = async (db, objectStore) => {
    const url = browser.runtime.getURL(`data/${objectStore}.json`)
    const resp = await fetch(url)
    const fixture = await resp.json()

    const tx = db.transaction(objectStore, "readwrite")
    for (const data of fixture) {
        const key = keyFor(tx.store.keyPath, data)
        const existing = await tx.store.get(key)
        if (existing === undefined) {
            console.debug(`Fixtures: Adding ${objectStore} ${key}`)
            try {
                await tx.store.add(data)
            } catch(error) {
                console.error(`Fixtures: Error adding ${objectStore} ${key}: ${error}`)
            }
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
                try {
                    await tx.store.put(existing)
                } catch(error) {
                    console.error(`Fixtures: Error updating ${objectStore} ${key}: ${error}`)
                }
            }
        }
    }
    await tx.done
}

export default async db => {
    await Promise.all([
        syncFixture(db, "items"),
        syncFixture(db, "locations"),
        syncFixture(db, "pets"),
        syncFixture(db, "quests"),
    ])
}
