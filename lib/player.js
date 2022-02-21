class Player {
    constructor() {
        // Just for the idb primary key.
        this.id = 1
        this.inventory = {}
        this.maxInventory = 100
        this.pets = {}
        this.cropImages = {}
        this.cropTimes = {}
        this.animalItems = {}
        this.currentPerkset = null
        this.perksets = null
        this.settings = {}
    }

    async load(db) {
        const data = await db.get("player", this.id)
        if (data !== null) {
            Object.assign(this, data)
        }
    }

    async save(db) {
        await db.put("player", this)
    }
}

export const setupPlayer = async state => {
    state.player = new Player()
    await state.player.load(state.db)
}
