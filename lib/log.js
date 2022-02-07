class ActionLog {
    constructor(db) {
        this.db = db
    }

    async log(data) {
        data.ts = Date.now()
        await this.db.put("log", data)
        return data
    }

    async restoreFromJSON(data) {
        const tx = this.db.transaction("log", "readwrite")
        for (const row of data) {
            delete row.id
            if (row.results.zone) {
                row.results.location = row.results.zone
                delete row.results.zone
            } else if (row.results.loc) {
                row.results.location = row.results.loc
                delete row.results.loc
            }
            await tx.store.put(row)
        }
        await tx.done
    }

    async explore(results) {
        return await this.log({type: "explore", results})
    }

    async lemonade(results) {
        return await this.log({type: "lemonade", results})
    }

    async cider(results) {
        return await this.log({type: "cider", results})
    }

    async net(results) {
        return await this.log({type: "net", results})
    }

    async spin(results) {
        return await this.log({type: "spin", results})
    }

    async harvestall(results) {
        return await this.log({type: "harvestall", results})
    }
}

// Promise-ify the downloads API.
const downloadInner = opts =>
    new Promise((resolve, reject) => {
        const downloadID = [null]
        const listener = downloadDelta => {
            if (downloadDelta.id === downloadID[0] && downloadDelta.state.current == "complete") {
                browser.downloads.onChanged.removeListener(listener)
                resolve(downloadDelta)
            }
        }
        browser.downloads.onChanged.addListener(listener)
        browser.downloads.download(opts).then(id => { downloadID[0] = id }).catch(reject)
    })


const downloadFile = async (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'})
    const url = URL.createObjectURL(blob)
    await downloadInner({url, filename: filename})
    URL.revokeObjectURL(url)
}

const clickLog = async (state, eventType, eventArg, msg) => {
    const log = await state.db.getAll("log")
    await downloadFile(log, "log.json")
    if (msg.shift) {
        const items = await state.db.getAll("items")
        await downloadFile(items, "items.json")
        const locations = await state.db.getAll("locations")
        await downloadFile(locations, "locations.json")
    }
}

export const setupLog = state => {
    state.log = new ActionLog(state.db)
    state.addClickHandler("log", clickLog)
}
