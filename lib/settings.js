import { renderSidebar } from "./sidebar.js"

const renderRowText = (text) => {
    return `
    <li class="farmrpg-ext-settings-row">
        <div class="item-content">
            <div class="item-inner">
                ${text}
            <div>
        </div>
    </li>
    `
}

const renderRowCheckbox = (state, label, name, value = "1") => {
    const checked = state.player.settings[name] === value ? 'checked="checked"' : ""
    return `
    <li class="farmrpg-ext-settings-row">
        <div class="item-content">
            <div class="item-inner">
                <div class="item-title label" style="width:60%">${label}</div>
                <label class="label-switch">
                    <input type="checkbox" name="${name}" value="${value}" ${checked}>
                    <div class="checkbox"></div>
                </label>
            </div>
        </div>
    </li>
    `
}

const renderSection = (state, label, rows) => {
    return `
    <div class="content-block-title">${label}</div>
    <div class="list-block inset">
        <ul>
            ${rows.join("\n")}
        </ul>
    </div>
    `
}

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
        renderRowCheckbox(
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
    return renderSection(state, "Perkset Quick Switcher Settings", perksetRows)
}

const renderAdvancedSettings = state => {
    return renderSection(state, "Advanced Settings - Alter At Your Own Risk", [
        renderRowCheckbox(state, "Enable Export", "show_export"),
        renderRowCheckbox(state, "XP Logging", "xp_logging"),
        renderRowCheckbox(state, "Harvest Logging", "harvest_logging"),
    ])
}

const renderSettings = state => {
    const html = `
    <div class="navbar">
        <div class="navbar-inner">
            <div class="left"><a href="x" class="back link"> <i class="icon icon-back"></i><span>Back</span></a></div>
            <div class="center sliding">FarmRPG-Ext Settings</div>
            <div class="right"><a href="x" data-panel="left" class="link open-panel icon-only"><i class="icon icon-bars"></i></a></div>
        </div>
    </div>
    <div class="pages">
        <div data-page="farmrpg-ext-settings" class="page">
            <div class="page-content">
                <div class="content-block">
                    <form id="farmrpg-ext-settings-form">
                    ${renderPerksetSettings(state)}
                    ${renderAdvancedSettings(state)}
                    </form>
                </div>
            </div>
        </div>
    </div>
    `
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
