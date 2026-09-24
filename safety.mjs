export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

export function normalizeTocConfig(config) {
    return {
        excludeFolders: Boolean(config.excludeFolders),
        folderName: typeof config.folderName === 'string' ? config.folderName : '',
        items: config.items.filter(item => item && typeof item === 'object')
            .filter(item => item.type === 'header' ? typeof item.text === 'string'
                : ['char', 'folder'].includes(item.type) && typeof item.id === 'string')
            .map(item => item.type === 'header' ? { type: 'header', text: item.text }
                : { type: item.type, id: item.id }),
    };
}

export function normalizeSettings(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const objectEntries = candidate => candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? Object.entries(candidate).filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key)) : [];
    const personaFolders = Object.fromEntries(objectEntries(source.persona_folders).filter(([, ids]) => Array.isArray(ids))
        .map(([name, ids]) => [name, ids.filter(id => typeof id === 'string')]));
    const lastPersonaFolder = source.last_persona_folder;
    return {
        enabled: source.enabled !== false,
        hiddenFolders: Array.isArray(source.hiddenFolders) ? source.hiddenFolders.filter(name => typeof name === 'string') : [],
        toc: Object.fromEntries(objectEntries(source.toc).filter(([, config]) =>
            config && typeof config === 'object' && Array.isArray(config.items))
            .map(([key, config]) => [key, normalizeTocConfig(config)])),
        collapsed_sections: Object.fromEntries(objectEntries(source.collapsed_sections).filter(([, collapsed]) => collapsed === true)),
        persona_folders: personaFolders,
        last_persona_folder: ['All', 'Uncategorized'].includes(lastPersonaFolder) ||
            (typeof lastPersonaFolder === 'string' && Object.hasOwn(personaFolders, lastPersonaFolder))
            ? lastPersonaFolder : 'All',
        theme: ['lavender', 'white_marble', 'dark', 'mocha'].includes(source.theme) ? source.theme : 'lavender',
        last_notice_id: typeof source.last_notice_id === 'string' ? source.last_notice_id : undefined,
    };
}
