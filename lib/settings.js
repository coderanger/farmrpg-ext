import { renderSidebar } from "./sidebar.js"

const renderCheckboxSetting = (state, label, name, value = "1") => {
    const checked = state.player.settings[name] === value ? 'checked="checked"' : ""
    return `
    <li>
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
    if (state.player.perksets === undefined || Object.keys(state.player.perksets).length <= 1) {
        // Perksets not available or none defined or only one defined, no need for switcher.
        return ""
    }
    const perksets = Object.entries(state.player.perksets)
    perksets.sort((a, b) => a[0].localeCompare(b[0]))
    const perksetRows = perksets.map(([perksetName, perksetID]) =>
        renderCheckboxSetting(state, perksetName, `perkset_${perksetID}`)
    )

    return renderSection(state, "Perkset Quick Switcher", perksetRows)
}

const renderAdvancedSettings = state => {
    return renderSection(state, "Advanced Settings - Alter At Your Own Risk", [
        renderCheckboxSetting(state, "Enable Export", "show_export"),
        renderCheckboxSetting(state, "XP Logging", "xp_logging"),
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
