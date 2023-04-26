import { DEFAULT_QUICK_ACTIONS } from "./quickActions.js"

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
        this.perks = {}
        this.farmSupply = {}
        this.perksByPerkset = {}
        this.orchard = null
        this.vineyard = null
        this.cellar = null
        this.quickActions = {}
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

    perkValue(perks) {
        let total = 0
        for (const [key, value] of Object.entries(perks)) {
            if (this.perks[key] || this.farmSupply[key]) {
                total += value
            }
        }
        return total
    }

    /**
     * Check if a quick action is registered for this item.
     * @param {string} item
     * @returns {typeof DEFAULT_QUICK_ACTIONS[""] | undefined}
     */
    quickActionFor(item) {
        return this.quickActions[item] || DEFAULT_QUICK_ACTIONS[item]
    }
}

export const setupPlayer = async state => {
    state.player = new Player()
    await state.player.load(state.db)
}
