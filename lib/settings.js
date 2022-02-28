import { renderSidebar } from "./sidebar.js"
import { renderPage, renderListBlock, renderRowCheckbox, renderRowText } from "./html.js"

const renderSettingsRowCheckbox = (state, label, name, value = "1") =>
    renderRowCheckbox(label, name, state.player.settings[name] === value ? 'checked="checked"' : "", value)

const renderPerksetSettings = state => {
    if (state.player.perksets === undefined) {
        // No perksets, no settings.
        return ""
    }
    const perksets = Object.values(state.player.perksets)
    if (perksets.length <= 1) {
        // Not enough perksets to switch.
        return ""
    }
    perksets.sort((a, b) => a.name.localeCompare(b.name))
    const perksetRows = perksets.map(perkset =>
        renderSettingsRowCheckbox(
            state,
            `<img src="${perkset.image}" />${perkset.name}`,
            `perkset_${perkset.id}`
        )
    )

    const helpRow = renderRowText(`
        The perkset quick switcher is the right-most button at the top of the extension sidebar. Clicking it will switch
        your perkset to the next one in the list, or back to the first if it's at the end. If you want the quick switcher
        to switch between only some of your perksets (the ones you use most frequently), toggle their setting on here.
    `)
    perksetRows.unshift(helpRow)
    return renderListBlock("Perkset Quick Switcher Settings", {inset: true}, perksetRows)
}

const renderAdvancedSettings = state => {
    return renderListBlock("Advanced Settings - Alter At Your Own Risk", {inset: true}, [
        renderSettingsRowCheckbox(state, "Enable Export", "show_export"),
        renderSettingsRowCheckbox(state, "XP Logging", "xp_logging"),
        renderSettingsRowCheckbox(state, "Harvest Logging", "harvest_logging"),
    ])
}

const renderSettings = state => {
    const html = renderPage("FarmRPG-Ext Settings", "settings", [
        renderPerksetSettings(state),
        renderAdvancedSettings(state),
    ])
    state.postMessage({action: "LOAD_CONTENT", changeAction: "SETTINGS", pageName: "farmrpg-ext-settings", html})
}

const updateSettings = async (state, msg) => {
    console.log(msg.data)
    state.player.settings = msg.data
    await state.player.save(state.db)
    await renderSidebar(state)
}

export const setupSettings = state => {
    state.addClickHandler("settings", renderSettings)
    state.addPostMessageHandler("SETTINGS", updateSettings)
}
