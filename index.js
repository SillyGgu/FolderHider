import {
    saveSettingsDebounced,
    entitiesFilter,
    characters
} from '../../../../script.js';

import { 
    extension_settings
} from '../../../extensions.js'; 

import {
    tags
} from '../../../../scripts/tags.js';

import {
    themeManager
} from './themes.js';

const extensionName = 'FolderHider';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const STYLE_ID = 'folder-hider-css-rules';
const HIDDEN_CLASS = 'folder-hider-js-hidden'; 

const DEFAULT_SETTINGS = {
    enabled: true,
    hiddenFolders: [], 
    toc: {},
    collapsed_sections: {},
    persona_folders: {},
    last_persona_folder: 'All',
    theme: 'lavender' 
};

let settings = extension_settings[extensionName];
if (!settings || Object.keys(settings).length === 0) {
    settings = Object.assign({}, DEFAULT_SETTINGS);
    extension_settings[extensionName] = settings;
    saveSettingsDebounced();
} else {
    settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    if (!settings.toc) settings.toc = {};
    extension_settings[extensionName] = settings;
}

let mainListObserver = null;
let personaListObserver = null;

// =========================================================================
// 1. CSS Injection
// =========================================================================

function injectCssRules() {
    $(`#${STYLE_ID}`).remove();
    
    
    const staticCss = `
        .${HIDDEN_CLASS} {
            display: none !important;
        }

        
        .folderhider-settings input[type="checkbox"],
        .toc-manager-modal input[type="checkbox"] {
            appearance: none; -webkit-appearance: none;
            width: 20px; height: 20px;
            border: 2px solid var(--fh-border, #ccc);
            border-radius: 5px; background-color: var(--fh-bg, #fff);
            cursor: pointer; position: relative; vertical-align: middle;
            transition: all 0.2s ease; outline: none; margin-right: 8px; flex-shrink: 0;
        }
        .folderhider-settings input[type="checkbox"]:checked,
        .toc-manager-modal input[type="checkbox"]:checked {
            background-color: var(--fh-accent); border-color: var(--fh-accent);
        }
        .folderhider-settings input[type="checkbox"]:checked::after,
        .toc-manager-modal input[type="checkbox"]:checked::after {
            content: ''; position: absolute;
            left: 5px; top: 1px; width: 5px; height: 10px;
            border: solid #fff; border-width: 0 2.5px 2.5px 0;
            transform: rotate(45deg);
        }
        .folderhider-settings input[type="checkbox"]:hover,
        .toc-manager-modal input[type="checkbox"]:hover {
            border-color: var(--fh-accent);
        }

        
        .char-list-separator {
            display: flex; align-items: center; justify-content: center;
            width: 100%; margin: 20px 0 10px 0; padding: 5px 0;
            color: var(--fh-text, #888); font-weight: bold; font-size: 0.9em;
            opacity: 0.9; pointer-events: none; position: relative;
            flex-shrink: 0; z-index: 5; scroll-margin-top: 50px;
        }
        .char-list-separator::before, .char-list-separator::after {
            content: ""; flex: 1; border-bottom: 2px solid var(--fh-border, rgba(128,128,128,0.3)); margin: 0 10px;
        }
        .char-list-separator span {
            background: var(--fh-bg, transparent); padding: 4px 12px; border-radius: 12px;
            border: 1px solid var(--fh-border, rgba(128,128,128,0.2));
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); color: var(--fh-accent);
        }

        
        #persona_folder_bar {
            display: flex; flex-wrap: nowrap; gap: 5px; padding: 5px;
            background: var(--fh-hover-bg, rgba(0,0,0,0.03));
            border-bottom: 1px solid var(--fh-border, #ccc);
            margin-bottom: 10px; align-items: center;
            overflow-x: auto;
            scrollbar-width: none; 
            -ms-overflow-style: none; 
        }
        #persona_folder_bar::-webkit-scrollbar {
            display: none; 
        }
        
        .persona-folder-tab {
            padding: 4px 10px; border-radius: 4px; cursor: pointer;
            font-size: 0.85em; background: var(--fh-bg, #eee);
            border: 1px solid var(--fh-border, transparent);
            color: var(--fh-text); opacity: 0.8;
            transition: all 0.2s; display: flex; align-items: center; gap: 5px;
            flex-shrink: 0; 
            white-space: nowrap; 
        }
        .persona-folder-tab:hover {
            opacity: 1; background: var(--fh-hover-bg, #ddd); border-color: var(--fh-accent);
        }
        .persona-folder-tab.active {
            opacity: 1; font-weight: bold;
            background: var(--fh-btn-bg, #bfaee3); color: var(--fh-btn-text, #fff);
            box-shadow: 0 1px 3px rgba(0,0,0,0.2); border-color: var(--fh-accent);
        }
        .persona-folder-settings-btn {
            margin-left: auto; cursor: pointer; padding: 5px; 
            color: var(--SmartThemeBodyColor);
            flex-shrink: 0; 
        }
        .persona-folder-settings-btn:hover { opacity: 1; color: var(--fh-accent); }
        
        
        .toc-manager-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Pretendard', sans-serif; color: var(--fh-text);
        }
        .toc-manager-modal {
            background: var(--fh-bg, #fff); width: 90%; max-width: 600px; max-height: 85vh;
            border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0,0,0,0.3); color: var(--fh-text); border: 1px solid var(--fh-border);
        }
        .toc-header {
            padding: 15px 20px; background: var(--fh-secondary, #e0e0f0); 
            border-bottom: 1px solid var(--fh-border);
            display: flex; justify-content: space-between; align-items: center; font-weight: bold;
            color: var(--fh-text);
        }
        .toc-toolbar {
            padding: 10px; background: var(--fh-hover-bg, #f0f2f5); 
            border-bottom: 1px solid var(--fh-border);
            display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem;
        }
        .toc-toolbar-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .toc-toolbar select, .toc-toolbar input {
            padding: 4px 8px; border: 1px solid var(--fh-border); 
            background: var(--fh-bg); color: var(--fh-text);
            border-radius: 4px; font-size: 0.85rem;
        }
        .toc-toolbar button, .toc-footer button {
            padding: 4px 10px; border: 1px solid var(--fh-border); 
            border-radius: 4px; background: var(--fh-btn-bg); 
            color: var(--fh-btn-text); cursor: pointer; font-weight: 600;
        }
        .toc-toolbar button:hover, .toc-footer button:hover { filter: brightness(1.05); }
        .toc-body { flex: 1; overflow-y: auto; padding: 10px; background: var(--fh-bg); }
        .toc-footer { 
            padding: 15px; background: var(--fh-bg); border-top: 1px solid var(--fh-border); 
            display: flex; gap: 10px; justify-content: flex-end; 
        }
        
        
        .toc-item {
            display: flex; align-items: center; padding: 6px 8px; 
            background: var(--fh-bg); border: 1px solid var(--fh-border); 
            margin-bottom: 5px; border-radius: 6px;
            transition: all 0.1s; user-select: none; cursor: grab;
            position: relative; flex-wrap: nowrap; height: auto;
            color: var(--fh-text);
        }
        .toc-item:active { cursor: grabbing; }

        
        .toc-item.type-header {
            background: var(--fh-secondary) !important;
            border: 1px solid var(--fh-accent);
            font-weight: bold;
            color: var(--fh-accent) !important; 
        }
        .toc-item.type-header .toc-item-name {
            color: inherit !important; 
            opacity: 1;
        }
        
        .toc-item:hover { background: var(--fh-hover-bg) !important; color: var(--fh-text) !important; }
        .toc-item.selected { 
            background: var(--fh-selected-bg) !important; border-color: var(--fh-accent) !important;
            box-shadow: 0 0 0 1px var(--fh-accent) inset; color: var(--fh-text) !important;
        }
        .toc-item.type-header.selected { background: var(--fh-btn-grad-1) !important; }

        
        .toc-item.dragging {
            opacity: 0.5;
            background: var(--fh-secondary) !important;
            border: 2px dashed var(--fh-accent) !important;
            box-shadow: 0 5px 10px rgba(0,0,0,0.1);
        }
        .toc-item.drag-over {
            border-top: 3px solid var(--fh-accent) !important;
            transform: translateY(-2px);
            transition: none;
            box-shadow: 0 -2px 5px rgba(0,0,0,0.1);
            z-index: 10;
        }

        .toc-item i { color: inherit; }
        .toc-btn {
            border: 1px solid var(--fh-border); background: var(--fh-btn-bg); 
            color: var(--fh-btn-text); border-radius: 4px;
            width: 24px; height: 24px; cursor: pointer;
            display: flex; justify-content: center; align-items: center; font-size: 0.8rem;
            transition: background 0.2s, color 0.2s;
        }
        .toc-btn:hover { background: var(--fh-accent); color: #fff; border-color: var(--fh-accent); }
        .toc-btn.del { color: #d63031; border-color: #fab1a0; background: #fff0f0; }
        .toc-btn.del:hover { background: #d63031; color: #fff; }
        
        .toc-btn.info { 
            position: relative;
            color: #0984e3; 
            border-color: #74b9ff; 
            background: #f0f8ff; 
        }
        .toc-btn.info:hover {
            background: #0984e3; 
            color: #fff; 
            border-color: #0984e3; 
        }
        
        .toc-tooltip {
            display: none; position: absolute; bottom: 30px; right: 0; width: 280px;
            background: var(--fh-bg); border: 1px solid var(--fh-accent);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;
            z-index: 9999; text-align: left; white-space: normal;
            pointer-events: none; cursor: default; color: var(--fh-text);
        }
        .toc-tooltip::after {
            content: ""; position: absolute; top: 100%; right: 8px;
            border-width: 6px; border-style: solid;
            border-color: var(--fh-accent) transparent transparent transparent;
        }
        .toc-btn.info:hover .toc-tooltip { display: block; animation: fadeIn 0.2s ease; }

        .toc-tags-row { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed var(--fh-border); }
        .toc-tag-pill {
            display: inline-block; background: var(--fh-hover-bg); border: 1px solid var(--fh-border);
            border-radius: 4px; padding: 1px 6px; margin: 0 4px 4px 0; font-size: 0.75rem; color: var(--fh-text);
        }
        .toc-desc-text { color: var(--fh-text); opacity: 0.8; font-size: 0.85rem; line-height: 1.4; }
        
        .toc-item-checkbox { pointer-events: auto; }
        .toc-item-name { flex: 1; margin-left: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
        .toc-controls { display: flex; gap: 4px; margin-left: 10px; align-items: center; }

        .toc-char-avatar {
            width: 36px; height: 36px; border-radius: 6px; object-fit: cover;
            margin: 0 8px 0 4px; border: 1px solid var(--fh-border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); background: var(--fh-hover-bg);
            flex-shrink: 0;
        }
        .toc-avatar-placeholder {
            width: 36px; height: 36px; border-radius: 6px;
            margin: 0 8px 0 4px; border: 1px solid var(--fh-border);
            background: var(--fh-hover-bg); flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; color: var(--fh-text); opacity: 0.4;
        }

        #persona_bulk_manage_btn {
            cursor: pointer; margin-right: 5px; color: var(--SmartThemeBodyColor); transition: color 0.2s;
        }
        #persona_bulk_manage_btn:hover { color: var(--fh-accent); }
        
        .persona-folder-badge {
            font-size: 0.75rem; background: var(--fh-secondary); color: var(--fh-text);
            padding: 2px 6px; border-radius: 4px; margin-left: 5px;
        }
        .pm-avatar-img {
            width: 40px; height: 40px; border-radius: 8px; object-fit: cover;
            margin: 0 10px 0 5px; border: 1px solid var(--fh-border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); background: #fff;
        }
        .pm-name-block { display: flex; align-items: center; flex: 1; flex-wrap: wrap; gap: 8px; }
        .pm-add-info {
            font-size: 0.75rem; color: var(--fh-text); opacity: 0.8;
            background: var(--fh-secondary); padding: 2px 8px;
            border-radius: 6px; border: 1px solid var(--fh-border); white-space: nowrap;
        }

        #fh_jump_btn {
            position: absolute; bottom: 15px; right: 25px; width: 32px; height: 32px;
            background: var(--fh-bg); color: var(--fh-text); border: 1px solid var(--fh-border);
            border-radius: 50%; display: none; justify-content: center; align-items: center;
            cursor: pointer; z-index: 200; opacity: 0.8; transition: all 0.2s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        #fh_jump_btn:hover, #fh_jump_btn.active { 
            opacity: 1; background: var(--fh-accent); color: #fff;
            transform: scale(1.1); border-color: var(--fh-accent);
        }
        #fh_jump_menu {
            position: absolute; bottom: 55px; right: 25px;
            background: var(--fh-bg); border: 1px solid var(--fh-border);
            border-radius: 8px; padding: 6px; display: none;
            flex-direction: column; gap: 4px; z-index: 201;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            max-height: 60vh; overflow-y: auto;
            min-width: 160px; font-size: 0.85rem; color: var(--fh-text);
        }
        .fh-jump-item {
            padding: 6px 10px; cursor: pointer; border-radius: 4px;
            color: var(--fh-text); border-bottom: 1px solid transparent; display: flex; align-items: center;
        }
        .fh-jump-item:hover { background: var(--fh-hover-bg); font-weight: bold; color: var(--fh-accent); }
        .fh-jump-item i { margin-right: 6px; font-size: 0.8em; opacity: 0.7; }

        .char-list-separator {
            cursor: pointer !important;
            pointer-events: auto !important;
        }
        .char-list-separator:hover span {
            background: var(--fh-hover-bg) !important;
        }
        .char-list-separator .fh-collapse-icon {
            margin-left: 8px;
            font-size: 0.75em;
            opacity: 0.6;
            transition: transform 0.2s;
            display: inline-block;
        }
        .char-list-separator.fh-collapsed .fh-collapse-icon {
            transform: rotate(-90deg);
        }
        .char-list-separator.fh-collapsed span {
            opacity: 0.6;
        }
    `;
    
    const $style = $(`<style id="${STYLE_ID}">`).text(staticCss);
    $('head').append($style);
}


// =========================================================================
// 2. Logic: 컨텍스트 식별 및 DOM 획득
// =========================================================================

function getCurrentContextId() {
    if (!entitiesFilter || !tags) return 'root';

    const filterData = entitiesFilter.getFilterData('tag');
    const selectedTags = filterData ? filterData.selected : [];

    const activeFolderTag = [...selectedTags]
        .reverse()
        .map(tagId => tags.find(t => t.id === tagId))
        .find(tag => tag && tag.folder_type);

    if (activeFolderTag) {
        return 'folder_' + activeFolderTag.id;
    }

    return 'root';
}

function getDomItems($container) {
    const items = [];
    $container.children().each(function() {
        const $el = $(this);
        if ($el.hasClass('char-list-separator')) return; 
        if ($el.hasClass('hidden_block')) return; 
        if ($el.attr('id') === 'BogusFolderBack') return; 

        let type = 'unknown';
        let id = null;
        let name = '';
        let tags = [];
        let description = '';

        if ($el.hasClass('character_select')) {
            type = 'char';
            name = $el.find('.ch_name').text().trim();
            const chid = $el.attr('data-chid');
            
            description = $el.find('.ch_description').text().trim();

            if (characters[chid] && characters[chid].avatar) {
                id = characters[chid].avatar; 
            } else {
                id = name;
            }

            $el.find('.tags .tag_name').each(function() {
                tags.push($(this).text().trim());
            });
        } else if ($el.hasClass('bogus_folder_select')) {
            type = 'folder';
            id = $el.attr('tagid'); 
            name = $el.find('.ch_name').text().trim();
            $el.find('.tags .tag_name').each(function() {
                tags.push($(this).text().trim());
            });
        }

        if (type !== 'unknown' && id) {
            items.push({ type, id, name, tags, description, $el }); 
        }
    });
    return items;
}

// =========================================================================
// 3. Logic: DOM 재배치 (Fluidity 대응)
// =========================================================================

let observerRaf = null;

function connectObserver() {
    const target = document.getElementById('rm_print_characters_block');
    if (target && !mainListObserver) {
        mainListObserver = new MutationObserver((mutations) => {

            // FolderHider 자신의 DOM 조작인지 확인 (detach/separator 삽입)
            const isSelfMutation = mutations.every(mutation =>
                Array.from(mutation.addedNodes).every(node =>
                    node.nodeType === 1 && node.classList.contains('char-list-separator')
                ) &&
                Array.from(mutation.removedNodes).every(node =>
                    node.nodeType === 1 && (
                        node.classList.contains('character_select') ||
                        node.classList.contains('bogus_folder_select') ||
                        node.classList.contains('char-list-separator') ||
                        node.classList.contains('hidden_block')
                    )
                )
            );

            if (isSelfMutation) return;

            // 즉시 숨김 처리 (hidden folder 깜빡임 방지)
            if (settings.enabled && settings.hiddenFolders.length > 0) {
                const isSubFolderView = document.getElementById('BogusFolderBack');
                if (!isSubFolderView) {
                    const hiddenTitles = settings.hiddenFolders.map(name => `[Folder] ${name.replace(/"/g, '\\"')}`);
                    mutations.forEach(mutation => {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === 1 && node.classList.contains('bogus_folder_select')) {
                                const title = node.querySelector('span.ch_name')?.getAttribute('title');
                                if (title && hiddenTitles.includes(title)) {
                                    node.classList.add(HIDDEN_CLASS);
                                }
                            }
                        });
                    });
                }
            }

            // ST 렌더 완료 신호 판별
            const hasHiddenBlock = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === 1 && node.classList.contains('hidden_block')
                )
            );

            // 메인화면 완료 신호: hidden_block 없이 bogus_folder_select 또는 character_select가 추가됨
            const hasCharOrFolder = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === 1 && (
                        node.classList.contains('character_select') ||
                        node.classList.contains('bogus_folder_select')
                    )
                )
            );
            const isMainRenderComplete = !hasHiddenBlock && hasCharOrFolder;

            // 폴더안 완료 신호: hidden_block이 포함된 append
            const isFolderRenderComplete = hasHiddenBlock;

            if (isMainRenderComplete || isFolderRenderComplete) {
                if (observerRaf) cancelAnimationFrame(observerRaf);
                observerRaf = requestAnimationFrame(() => {
                    observerRaf = null;
                    hideFoldersOnListUpdate();
                });
            }
        });
        mainListObserver.observe(target, { childList: true, subtree: false });
    }
}


function disconnectObserver() {
    if (mainListObserver) {
        mainListObserver.disconnect();
        mainListObserver = null;
    }
    if (observerRaf) {
        cancelAnimationFrame(observerRaf);
        observerRaf = null;
    }
}

// =========================================================================
// Jump Button Logic
// =========================================================================
function injectJumpButton() {
    const $parent = $('#rm_characters_block');
    if ($parent.find('#fh_jump_btn').length === 0) {
        $parent.append(`
            <div id="fh_jump_btn" title="구분선으로 이동">
                <i class="fa-solid fa-list-ul"></i>
            </div>
            <div id="fh_jump_menu"></div>
        `);

        $('#fh_jump_btn').click(function(e) {
            e.stopPropagation();
            const $menu = $('#fh_jump_menu');
            const isVisible = $menu.is(':visible');
            
            if (isVisible) {
                $menu.fadeOut(100);
                $(this).removeClass('active');
            } else {
                updateJumpMenu(); 
                $menu.fadeIn(100).css('display', 'flex');
                $(this).addClass('active');
            }
        });

        $(document).click(function(e) {
            if (!$(e.target).closest('#fh_jump_btn, #fh_jump_menu').length) {
                $('#fh_jump_menu').fadeOut(100);
                $('#fh_jump_btn').removeClass('active');
            }
        });
    }
}

function updateJumpMenu() {
    const $menu = $('#fh_jump_menu');
    $menu.empty();

    const $container = $('#rm_print_characters_block');
    const separators = $container.find('.char-list-separator');

    if (separators.length === 0) {
        $('#fh_jump_btn').hide(); 
        $menu.hide();
        return;
    } else {
        $('#fh_jump_btn').css('display', 'flex'); 
    }

    separators.each(function(index) {
        const $sep = $(this);
        const text = $sep.find('span').text();
        
        const $item = $(`<div class="fh-jump-item"><i class="fa-solid fa-chevron-right"></i> ${text}</div>`);
        
        $item.click(function() {
            const currentScroll = $container.scrollTop();
            const sepTop = $sep.offset().top;
            const containerTop = $container.offset().top;
            
            const targetTop = currentScroll + sepTop - containerTop;

            $container[0].scrollTo({
                top: targetTop,
                behavior: 'smooth'
            });
            
            $menu.fadeOut(100);
            $('#fh_jump_btn').removeClass('active');
        });

        $menu.append($item);
    });

    $menu.append('<div style="border-top:1px solid #ddd; margin: 4px 0;"></div>');
    const $topItem = $(`<div class="fh-jump-item" style="color:#666;"><i class="fa-solid fa-arrow-up"></i> 맨 위로</div>`);
    $topItem.click(function(){
         $container[0].scrollTo({ top: 0, behavior: 'smooth' });
         $menu.fadeOut(100);
         $('#fh_jump_btn').removeClass('active');
    });
    $menu.append($topItem);
}

// =========================================================================
// ToC Button in Character List Panel
// =========================================================================
function addTocButton() {
    if ($('#fh_toc_char_btn').length > 0) {
        return;
    }

    const tocButton = $('<div>', {
        id: 'fh_toc_char_btn',
        class: 'menu_button fa-solid fa-list-ol interactable',
        title: '목차/순서 편집',
        tabindex: '0',
        role: 'button',
        'data-i18n': '[title]목차/순서 편집'
    });

    tocButton.on('click', function(event) {
        event.stopPropagation();
        renderTocManagerPopup();
    });

    const $botBtn = $('#rm_button_bot');
    if ($botBtn.length > 0) {
        $botBtn.after(tocButton);
    } else {
        $('#rm_button_group_chats').after(tocButton);
    }

    console.log('[FolderHider] ToC button added to character list panel');
}

function applyTocOrderToDom($container) {
    if (!settings.enabled) return;

    disconnectObserver();

    const contextId = getCurrentContextId();
    
    const isVisuallyInFolder = $container.find('#BogusFolderBack').length > 0;

    if (contextId === 'root' && isVisuallyInFolder) {
        connectObserver();
        updateJumpMenu();
        return;
    }

    const tocConfig = settings.toc[contextId];

    if (!tocConfig || !tocConfig.items || tocConfig.items.length === 0) {
        $container.find('.char-list-separator').remove();
        connectObserver();
        updateJumpMenu(); 
        return;
    }

    const currentItems = getDomItems($container);
    const realTocItems = tocConfig.items.filter(i => i.type !== 'header');
    
    if (currentItems.length > 0 && realTocItems.length > 0) {
        const domKeySet = new Set(currentItems.map(i => `${i.type}_${i.id}`));
        
        let matchCount = 0;
        
        matchCount += realTocItems.filter(i => domKeySet.has(`${i.type}_${i.id}`)).length;

        if (matchCount === 0) {
            const domNameSet = new Set(currentItems.map(i => i.name));
            matchCount += realTocItems.filter(i => domNameSet.has(i.id)).length;
        }

        if (matchCount === 0) {
            connectObserver();
            updateJumpMenu();
            return;
        }
    }
    // -------------------------------------------------------------------------

    $container.css('visibility', 'hidden');

    // 1. 일단 DOM 요소들을 모두 떼어냄 (Detach)
    currentItems.forEach(item => item.$el.detach());

    // 2. 뒤로가기 버튼 처리 (최상단 보장)
    const $backBtn = $container.find('#BogusFolderBack');
    if ($backBtn.length) {
        $backBtn.detach();
        $container.prepend($backBtn);
    }

    $container.find('.char-list-separator').remove();

    // 3. 맵핑 준비 (파일명 기준)
    const itemMap = new Map(); 
    currentItems.forEach(item => {
        const key = `${item.type}_${item.id}`;
        itemMap.set(key, item);
    });

    const excludeFolders = tocConfig.excludeFolders;
    
    // (A) 폴더 제외 모드일 경우 폴더 먼저 배치
    if (excludeFolders) {
        currentItems.forEach(item => {
            if (item.type === 'folder') {
                const key = `folder_${item.id}`;
                const itemObj = itemMap.get(key);
                if (itemObj) {
                    $container.append(itemObj.$el);
                }
            }
        });
    }

    // (B) 저장된 목차(ToC) 순서대로 배치
    tocConfig.items.forEach(confItem => {
        if (confItem.type === 'header') {
            const contextId = getCurrentContextId();
            const collapseKey = `${contextId}__${confItem.text}`;
            const isCollapsed = settings.collapsed_sections && settings.collapsed_sections[collapseKey];
            const $sep = $(`
                <div class="char-list-separator${isCollapsed ? ' fh-collapsed' : ''}" data-collapse-key="${collapseKey}">
                    <span>${confItem.text}<i class="fa-solid fa-chevron-down fh-collapse-icon"></i></span>
                </div>
            `);
            $sep.on('click', function() {
                const key = $(this).data('collapse-key');
                const nowCollapsed = $(this).hasClass('fh-collapsed');
                if (nowCollapsed) {
                    $(this).removeClass('fh-collapsed');
                    if (settings.collapsed_sections) delete settings.collapsed_sections[key];
                    let $next = $(this).next();
                    while ($next.length && !$next.hasClass('char-list-separator')) {
                        $next.removeClass(HIDDEN_CLASS);
                        $next = $next.next();
                    }
                } else {
                    $(this).addClass('fh-collapsed');
                    if (!settings.collapsed_sections) settings.collapsed_sections = {};
                    settings.collapsed_sections[key] = true;
                    let $next = $(this).next();
                    while ($next.length && !$next.hasClass('char-list-separator')) {
                        $next.addClass(HIDDEN_CLASS);
                        $next = $next.next();
                    }
                }
                saveSettingsDebounced();
            });
            $container.append($sep);
        } else {
            if (confItem.type === 'folder' && excludeFolders) return; 

            let key = `${confItem.type}_${confItem.id}`;
            let item = itemMap.get(key);

            if (!item) {
                item = currentItems.find(i => 
                    i.name === confItem.id &&
                    i.type === confItem.type && 
                    i.$el.parent().length === 0 
                );
            }

            if (item && item.$el.parent().length === 0) {
                $container.append(item.$el);
            }
        }
    });

    // (C) 유동성 대응 
    currentItems.forEach(item => {
        if (item.$el.parent().length === 0) {
            $container.append(item.$el);
        }
    });

    // (D) 히든 카운터 블록 처리
    const $hiddenBlock = $container.find('.hidden_block');
    $hiddenBlock.detach();
    $container.append($hiddenBlock);

    if (settings.collapsed_sections) {
        $container.find('.char-list-separator.fh-collapsed').each(function() {
            let $next = $(this).next();
            while ($next.length && !$next.hasClass('char-list-separator')) {
                $next.addClass(HIDDEN_CLASS);
                $next = $next.next();
            }
        });
    }

    $container.css('visibility', '');
    connectObserver();
    
    updateJumpMenu();
}


function hideFoldersOnListUpdate() {
    const $characterBlock = $('#rm_print_characters_block');
    
    if (settings.enabled) {
        applyTocOrderToDom($characterBlock);
    }

    $characterBlock.find('.bogus_folder_select').removeClass(HIDDEN_CLASS);
    
    if (settings.enabled && settings.hiddenFolders.length > 0) {
        const isSubFolderView = $characterBlock.find('#BogusFolderBack').length > 0;
        const hiddenTitles = settings.hiddenFolders.map(name => `[Folder] ${name.replace(/"/g, '\\"')}`);

        if (!isSubFolderView) {
            $characterBlock.find('div.bogus_folder_select').each(function() {
                const title = $(this).find('span.ch_name').attr('title');
                if (title && hiddenTitles.includes(title)) {
                    $(this).addClass(HIDDEN_CLASS);
                }
            });
        }
    }
}

// =========================================================================
// 4. UI: 목차 관리 팝업 & 백업
// =========================================================================

function renderTocManagerPopup() {
    const contextId = getCurrentContextId();
    const contextTagName = contextId.startsWith('folder_') 
        ? (tags.find(t => 'folder_' + t.id === contextId)?.name || '폴더 내부') 
        : '메인 목록 (Root)';

    const savedConfig = settings.toc[contextId] || { excludeFolders: true, items: [] };
    const $container = $('#rm_print_characters_block');
    const currentItems = getDomItems($container); 

    let workingConfigItems = savedConfig.items || [];
    let isConfigMismatch = false;

    const realConfigItems = workingConfigItems.filter(i => i.type !== 'header');
    if (currentItems.length > 0 && realConfigItems.length > 0) {
        const domKeySet = new Set(currentItems.map(i => `${i.type}_${i.id}`));
        let matchCount = realConfigItems.filter(i => domKeySet.has(`${i.type}_${i.id}`)).length;
        if (matchCount === 0) {
            const domNameSet = new Set(currentItems.map(i => i.name));
            matchCount += realConfigItems.filter(i => domNameSet.has(i.id)).length;
        }
        if (matchCount === 0) {
            console.warn(`[FolderHider] Context mismatch detected in Popup.`);
            workingConfigItems = []; 
            isConfigMismatch = true;
        }
    }

    let workingList = [];
    const currentItemMap = new Map();
    const allTagsSet = new Set(); 

    currentItems.forEach(i => {
        currentItemMap.set(`${i.type}_${i.id}`, i);
        if (i.tags && i.tags.length > 0) {
            i.tags.forEach(t => allTagsSet.add(t));
        }
    });

    const sortedTags = Array.from(allTagsSet).sort();

    if (workingConfigItems.length > 0) {
        workingConfigItems.forEach(confItem => {
            if (confItem.type === 'header') {
                workingList.push({ type: 'header', text: confItem.text, id: `header_${Date.now()}_${Math.random()}` });
            } else {
                const key = `${confItem.type}_${confItem.id}`;
                if (currentItemMap.has(key)) {
                    workingList.push(currentItemMap.get(key));
                    currentItemMap.delete(key);
                }
            }
        });
    }
    
    currentItemMap.forEach((val) => workingList.push(val));

    const tagOptionsHtml = sortedTags.map(tag => `<option value="${tag}">`).join('');
    
    const displayTitle = isConfigMismatch 
        ? `${contextTagName} (주의: 상위 설정 분리됨)` 
        : `${contextTagName} - 목차 관리`;
const popupHtml = `
        <div class="toc-manager-overlay" id="toc_manager_popup">
			<div class="toc-manager-modal" id="toc_manager_modal_inner">
				<div class="toc-header" style="display:flex; align-items:center; justify-content:space-between; padding: 18px 24px; border-bottom: 1px solid var(--fh-border);">
					<span style="font-size:1.1rem; font-weight:700; letter-spacing:-0.3px;">${displayTitle}</span>
                    <i class="fa-solid fa-xmark close-toc-btn" style="cursor:pointer; font-size:1.2rem; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"></i>
                </div>
                
<div class="toc-toolbar" style="padding: 16px 24px; border-bottom: 1px solid var(--fh-border); display:flex; flex-direction:column; gap:10px;">
                    <div class="toc-toolbar-row" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <button id="toc_select_all_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">전체 선택</button>
                        <button id="toc_deselect_all_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">선택 해제</button>
                        <div style="width:1px; height:20px; background:var(--fh-border); margin:0 2px;"></div>
                        <input type="text" id="toc_tag_filter_input" list="toc_tag_datalist" placeholder="태그 선택 또는 검색..." style="width:150px; padding: 7px 12px; border-radius:8px; font-size:0.9rem;">
                        <datalist id="toc_tag_datalist">${tagOptionsHtml}</datalist>
                        <button id="toc_select_by_tag_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">태그로 선택</button>
                    </div>
                    <div class="toc-toolbar-row" style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.9rem; opacity:0.7; white-space:nowrap;">선택한 항목을:</span>
                        <select id="toc_move_target_select" style="flex:1; min-width:150px; padding: 7px 10px; border-radius:8px; font-size:0.9rem;">
                            <option value="">(이동할 구분선 선택)</option>
                        </select>
                        <button id="toc_move_execute_btn" style="padding: 7px 18px; border-radius:8px; font-size:0.9rem; font-weight:600; white-space:nowrap;">▼ 여기로 이동</button>
                    </div>
                </div>

                <div class="toc-body" id="toc_items_list" style="padding: 16px 24px; overflow-y:auto;">
                    <div class="toc-checkbox-row" style="margin-bottom:12px; padding: 10px 14px; border-radius:8px; background:var(--fh-hover-bg); border:1px solid var(--fh-border); display:flex; flex-direction:column; gap:8px;">
                        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9rem; font-weight:600;">
                                <input type="checkbox" id="toc_exclude_folders" ${savedConfig.excludeFolders ? 'checked' : ''}>
                                폴더 제외하기 (폴더는 항상 맨 위에 고정, 정렬 제외)
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9rem; font-weight:600;">
                                <input type="checkbox" id="toc_toggle_images">
                                🖼️ 이미지 표시
                            </label>
                        </div>
                        <div style="position:relative; width:100%;">
                            <input type="text" id="toc_search_input" placeholder="🔍 이름 검색..." style="width:100%; padding: 6px 32px 6px 12px; border-radius:7px; font-size:0.88rem; border:1px solid var(--fh-border); background:var(--fh-bg); color:var(--fh-text); box-sizing:border-box;">
                            <i class="fa-solid fa-xmark" id="toc_search_clear" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; opacity:0.4; font-size:0.85rem; display:none; color:var(--fh-text);"></i>
                        </div>
                    </div>
                </div>
                <div class="toc-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:8px; padding: 14px 24px; border-top: 1px solid var(--fh-border);">
                    <button class="lavender-btn reset-toc-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem; background: #ff7675 !important; color: #fff !important; margin-right: auto;">↻ 데이터 삭제(초기화)</button>
                    <button class="lavender-btn add-sep-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem;">+ 구분선 추가</button>
                    <button class="lavender-btn save-toc-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem;">저장 및 적용</button>
                </div>
            </div>
        </div>
    `;

    $('body').append(popupHtml);
    const $list = $('#toc_items_list');
    const $targetSelect = $('#toc_move_target_select');
    const $overlay = $('#toc_manager_popup');
    const $modal = $('#toc_manager_modal_inner');

    function updatePopupPosition() {
        if ($modal.length === 0) return;
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            const $chat = $('#chat');
            $overlay.css({ 'display': 'block', 'padding': '0' });
            if ($chat.length > 0) {
                const rect = $chat[0].getBoundingClientRect();
                $modal.css({
                    'position': 'fixed', 'top': rect.top + 'px', 'height': rect.height + 'px',
                    'left': '50%', 'transform': 'translateX(-50%)', 'width': '98%',
                    'max-width': 'unset', 'max-height': 'unset', 'border-radius': '12px', 'margin': '0'
                });
            }
        } else {
            $overlay.css({ 'display': 'flex', 'justify-content': 'center', 'align-items': 'center', 'padding': '' });
            $modal.css({
                'position': 'relative', 'top': '', 'left': '', 'transform': '', 'width': '90%',
                'height': '', 'max-width': '600px', 'max-height': '85vh', 'margin': ''
            });
        }
    }
    updatePopupPosition();
    $(window).on('resize.tocManager', updatePopupPosition);

    function closePopup() {
        $(window).off('resize.tocManager');
        $('#toc_manager_popup').remove();
    }

    function renderList() {
        const scrollTop = $list.scrollTop();
		const avatarToChid = new Map();
		$('#rm_print_characters_block .character_select').each(function() {
			const chid = $(this).attr('data-chid');
			const chObj = characters[chid];
			if (chObj && chObj.avatar) avatarToChid.set(chObj.avatar, chid);
		});
        $list.find('.toc-item').remove();
        $targetSelect.find('option:not(:first)').remove(); 

        const excludeFolders = $('#toc_exclude_folders').is(':checked');
        const hiddenFolders = settings.hiddenFolders || [];
        const showImages = $('#toc_toggle_images').is(':checked');
        const searchQuery = ($('#toc_search_input').val() || '').toLowerCase().trim();

        workingList.forEach((item, index) => {
            if (excludeFolders && item.type === 'folder') return;
            if (searchQuery && item.type !== 'header' && !item.name.toLowerCase().includes(searchQuery)) return;

            if (item.type === 'header') {
                $targetSelect.append(`<option value="${index}">[구분선] ${item.text}</option>`);
            }

            let isHidden = false;
            if (item.type === 'folder' && hiddenFolders.includes(item.name)) {
                isHidden = true;
            }

            const isHeader = item.type === 'header';
            const name = isHeader ? `[구분선] ${item.text}` : item.name;
            const iconClass = isHeader ? 'fa-heading' : (item.type === 'folder' ? 'fa-folder' : 'fa-user');
            const isChecked = item._selected ? 'checked' : '';
            const selectedClass = item._selected ? 'selected' : '';
            const hiddenClass = isHidden ? 'is-hidden' : '';
            
            let infoBtnHtml = '';
            if (!isHeader) {
                const tagsHtml = (item.tags && item.tags.length > 0) 
                    ? item.tags.map(t => `<span class="toc-tag-pill">${t}</span>`).join('') 
                    : '';
                const descHtml = (item.description) ? `<div class="toc-desc-text">${item.description}</div>` : '';
                
                if (tagsHtml || descHtml) {
                    infoBtnHtml = `
                        <div class="toc-btn info">
                            <i class="fa-solid fa-info"></i>
                            <div class="toc-tooltip">
                                ${tagsHtml ? `<div class="toc-tags-row">${tagsHtml}</div>` : ''}
                                ${descHtml || '<span style="color:#aaa;">설명 없음</span>'}
                            </div>
                        </div>
                    `;
                }
            }

            let avatarHtml = '';
            if (!isHeader && showImages) {
				const chid = avatarToChid.get(item.id);
				const imgSrc = (chid !== undefined && characters[chid] && characters[chid].avatar)
					? `/characters/${characters[chid].avatar}`
					: null;
                avatarHtml = imgSrc
                    ? `<img src="${imgSrc}" class="toc-char-avatar" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='flex');">`
                    : `<div class="toc-avatar-placeholder"><i class="fa-solid fa-user"></i></div>`;
            }

            const html = `
                <div class="toc-item ${isHeader ? 'type-header' : 'type-' + item.type} ${hiddenClass} ${selectedClass}" 
                     data-index="${index}" 
                     draggable="true">
                    <input type="checkbox" class="toc-item-checkbox" ${isChecked}>
                    ${avatarHtml}
                    ${!showImages || isHeader ? `<i class="fa-solid ${iconClass}"></i>` : ''}
                    <span class="toc-item-name" ${isHeader ? 'contenteditable="true"' : ''}>${name}</span>
                    <div class="toc-controls">
                        ${infoBtnHtml}
                        <div class="toc-btn up"><i class="fa-solid fa-arrow-up"></i></div>
                        <div class="toc-btn down"><i class="fa-solid fa-arrow-down"></i></div>
                        ${isHeader ? `
                            <div class="toc-btn sort-section" title="이 섹션 이름순 정렬"><i class="fa-solid fa-arrow-down-a-z"></i></div>
                            <div class="toc-btn del"><i class="fa-solid fa-trash"></i></div>
                        ` : ''}
                    </div>
                </div>
            `;
            $list.append(html);
        });

        $list.scrollTop(scrollTop);
        bindItemEvents();
    }

    function bindItemEvents() {
        $list.find('.toc-item').off('click').on('click', function(e) {
            if ($(e.target).is('input, button, .toc-btn, .toc-btn *, [contenteditable="true"]')) return;
            const $checkbox = $(this).find('.toc-item-checkbox');
            $checkbox.prop('checked', !$checkbox.prop('checked')).trigger('change');
        });

        $list.find('.toc-item-checkbox').off('change').on('change', function(e) {
            const $item = $(this).closest('.toc-item');
            const idx = $item.data('index');
            const isChecked = $(this).is(':checked');
            workingList[idx]._selected = isChecked;
            if (isChecked) $item.addClass('selected');
            else $item.removeClass('selected');
        });

        $list.find('.toc-btn.up').click(function(e) {
            e.stopPropagation(); 
            const idx = $(this).closest('.toc-item').data('index');
            if (idx > 0) { [workingList[idx], workingList[idx-1]] = [workingList[idx-1], workingList[idx]]; renderList(); }
        });
        $list.find('.toc-btn.down').click(function(e) {
            e.stopPropagation();
            const idx = $(this).closest('.toc-item').data('index');
            if (idx < workingList.length - 1) { [workingList[idx], workingList[idx+1]] = [workingList[idx+1], workingList[idx]]; renderList(); }
        });
        $list.find('.toc-btn.del').click(function(e) {
            e.stopPropagation();
            if (confirm('이 구분선을 삭제하시겠습니까?')) { workingList.splice($(this).closest('.toc-item').data('index'), 1); renderList(); }
        });

        $list.find('.toc-btn.sort-section').click(function(e) {
            e.stopPropagation();
            const headerIdx = $(this).closest('.toc-item').data('index');
            let sectionStart = headerIdx + 1;
            let sectionEnd = workingList.length;
            for (let i = sectionStart; i < workingList.length; i++) {
                if (workingList[i].type === 'header') {
                    sectionEnd = i;
                    break;
                }
            }
            if (sectionEnd <= sectionStart) return;
            const sectionItems = workingList.slice(sectionStart, sectionEnd);
            sectionItems.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
            workingList.splice(sectionStart, sectionEnd - sectionStart, ...sectionItems);
            renderList();
        });
        
        $list.find('.toc-item-name[contenteditable]').on('blur', function() {
            const idx = $(this).closest('.toc-item').data('index');
            const newText = $(this).text().replace('[구분선] ', '').trim();
            if (workingList[idx].type === 'header') workingList[idx].text = newText;
            $(this).closest('.toc-item').attr('draggable', 'true');
        }).on('mousedown click', function(e) {
            $(this).closest('.toc-item').attr('draggable', 'false');
            e.stopPropagation(); 
        });
		let $allItems = $list.find('.toc-item');

        // [드래그 앤 드롭]
        let draggedIndex = null;
        
        $list.find('.toc-item').on('dragstart', function(e) {
            if ($(e.target).is('input, button, .toc-btn, .toc-btn *, [contenteditable="true"]')) {
                e.preventDefault(); return;
            }
            draggedIndex = $(this).data('index');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', draggedIndex);
            
            if (workingList[draggedIndex]._selected) {
                $list.find('.toc-item').each(function() { 
                    if (workingList[$(this).data('index')]._selected) $(this).addClass('dragging'); 
                });
            } else { 
                $(this).addClass('dragging'); 
            }
        });

        $list.find('.toc-item').on('dragend', function() { 
            $('.toc-item').removeClass('dragging drag-over'); 
            draggedIndex = null; 
        });

		let lastDragOver = 0;
		$allItems.on('dragover', function(e) {
			e.preventDefault();
			e.originalEvent.dataTransfer.dropEffect = 'move';

			const now = Date.now();
			if (now - lastDragOver < 30) return;
			lastDragOver = now;

			$allItems.removeClass('drag-over');
			const idx = $(this).data('index');

			const isDraggingSelected = (draggedIndex !== null) && workingList[draggedIndex] && workingList[draggedIndex]._selected;
			if (isDraggingSelected && workingList[idx]._selected) return;
			if (draggedIndex === idx && !isDraggingSelected) return;

			$(this).addClass('drag-over');
		});

        $list.find('.toc-item').on('drop', function(e) {
            e.preventDefault(); 
            $('.toc-item').removeClass('drag-over dragging');
            
            const droppedIndex = $(this).data('index');
            if (draggedIndex === null || draggedIndex === undefined) return;
            
            const droppedItem = workingList[droppedIndex]; 
            const isMultiDrag = workingList[draggedIndex]._selected;
            
            if (isMultiDrag) {
                if (droppedItem._selected) return; 
                const itemsToMove = workingList.filter(item => item._selected);
                const remainingItems = workingList.filter(item => !item._selected);
                
                let newIndex = remainingItems.indexOf(droppedItem);
                if (newIndex !== -1) { 
                    remainingItems.splice(newIndex, 0, ...itemsToMove); 
                    workingList = remainingItems; 
                    renderList(); 
                }
            } 
            else if (draggedIndex !== droppedIndex) {
                const itemToMove = workingList[draggedIndex];
                const tempArray = [...workingList];
                
                tempArray.splice(draggedIndex, 1);
                
                let targetIndex = tempArray.indexOf(droppedItem);
                if (targetIndex !== -1) {
                    tempArray.splice(targetIndex, 0, itemToMove);
                    workingList = tempArray; 
                    renderList();
                }
            }
        });
    }

    renderList();

    $('#toc_select_all_btn').click(() => { workingList.forEach(item => item._selected = true); renderList(); });
    $('#toc_deselect_all_btn').click(() => { workingList.forEach(item => item._selected = false); renderList(); });
    $('#toc_select_by_tag_btn').click(() => {
        const tagQuery = $('#toc_tag_filter_input').val().trim().toLowerCase();
        if (!tagQuery) return alert('검색할 태그를 입력하거나 목록에서 선택하세요.');
        let count = 0;
        workingList.forEach(item => {
            if (item.type === 'char' && item.tags && item.tags.some(t => t.toLowerCase().includes(tagQuery))) {
                item._selected = true; count++;
            }
        });
        renderList();
        if (count === 0) alert('해당 태그를 가진 캐릭터가 없습니다.');
    });
    $('#toc_move_execute_btn').click(() => {
        const targetIdxStr = $('#toc_move_target_select').val();
        if (targetIdxStr === "") return alert('이동할 위치(구분선)를 선택하세요.');
        const itemsToMove = workingList.filter(item => item._selected);
        if (itemsToMove.length === 0) return alert('선택된 항목이 없습니다.');
        const unselectedList = workingList.filter(item => !item._selected);
        const targetObj = workingList[parseInt(targetIdxStr)];
        let newTargetIdx = unselectedList.indexOf(targetObj);
        if (newTargetIdx === -1) return alert('이동하려는 구분선이 선택되어 있습니다. 구분선 선택을 해제하세요.');
        unselectedList.splice(newTargetIdx + 1, 0, ...itemsToMove);
        itemsToMove.forEach(i => i._selected = false);
        workingList = unselectedList;
        renderList();
    });

    $('.reset-toc-btn').click(() => {
        if(confirm(`[${contextTagName}] 순서 변경 내역을 삭제하고 초기화하시겠습니까?`)) {
            if (isConfigMismatch) {
                alert('현재 폴더 인식이 불안정하여, 안전을 위해 부모 설정 삭제를 방지했습니다.\n팝업을 다시 열어 확인해주세요.');
                closePopup();
                return;
            }
            delete settings.toc[contextId];
            saveSettingsDebounced();
            closePopup();
            hideFoldersOnListUpdate();
            $('#character_sort_order').trigger('change');
            alert('초기화되었습니다.');
        }
    });

    $('#toc_exclude_folders').change(renderList);
    $('#toc_toggle_images').change(renderList);
    $('#toc_search_input').on('input', function() {
        const hasVal = $(this).val().length > 0;
        $('#toc_search_clear').toggle(hasVal);
        renderList();
    });
    $('#toc_search_clear').click(function() {
        $('#toc_search_input').val('');
        $(this).hide();
        renderList();
    });
    $('.add-sep-btn').click(() => {
        const t = prompt('구분선 이름:', '새 분류');
        if (t) { workingList.push({type:'header', text:t, id: `header_${Date.now()}`}); renderList(); }
    });
    $('.close-toc-btn').click(closePopup);
    
    $('.save-toc-btn').click(() => {
        const excludeFolders = $('#toc_exclude_folders').is(':checked');
        const saveItems = workingList.map(item => {
            if (item.type === 'header') return { type: 'header', text: item.text };
            return { type: item.type, id: item.id };
        });

        settings.toc[contextId] = { 
            excludeFolders, 
            items: saveItems,
            folderName: contextTagName 
        };
        saveSettingsDebounced();
        
        hideFoldersOnListUpdate();
        closePopup();
        alert('목차 순서가 저장 및 적용되었습니다.');
    });
}

function onExportSettings() {
    const contextId = getCurrentContextId();
    let currentToc = settings.toc[contextId];
    let isAutoGenerated = false;

    if (!currentToc) {
        const $container = $('#rm_print_characters_block');
        const items = getDomItems($container);
        
        const capturedItems = items.map(item => ({
            type: item.type,
            id: item.id
        }));

        currentToc = {
            excludeFolders: true, 
            folderName: contextId === 'root' ? 'Main List' : contextId,
            items: capturedItems
        };
        isAutoGenerated = true;
    }

    const exportData = {
        version: 2,
        type: 'context_backup', 
        contextId: contextId,
        timestamp: new Date().toLocaleString(),
        data: currentToc
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    $('#setting_backup_area').val(jsonStr);

    let msg = `[${currentToc.folderName || contextId}] 목록의 순서 데이터가 추출되었습니다.`;
    if (isAutoGenerated) {
        msg += '\n(주의: 아직 저장되지 않은 상태라 현재 화면 순서를 기반으로 생성했습니다)';
    }
    alert(msg);
}

function onImportSettings() {
    const jsonStr = $('#setting_backup_area').val().trim();
    if (!jsonStr) { alert('내용이 없습니다.'); return; }

    try {
        const parsed = JSON.parse(jsonStr);

        // 1. 신규 방식: 특정 목록(폴더)만 백업한 데이터인 경우
        if (parsed.type === 'context_backup' && parsed.contextId && parsed.data) {
            const targetId = parsed.contextId;
            const targetName = parsed.data.folderName || targetId;

            if (confirm(`[${targetName}] 목록의 설정을 불러옵니다.\n\n이 작업은 다른 폴더의 설정은 건드리지 않고,\n현재 보고 있는 목록(또는 지정된 폴더)의 순서만 변경합니다.\n진행하시겠습니까?`)) {
                
                settings.toc[targetId] = parsed.data;
                extension_settings[extensionName] = settings;
                saveSettingsDebounced();

                if (getCurrentContextId() === targetId) {
                    hideFoldersOnListUpdate();
                }

                alert(`[${targetName}] 설정이 성공적으로 적용되었습니다.`);
            }
            return;
        }

        // 2. 구형 방식: 전체 설정 백업본인 경우 (기존 호환성 유지)
        if (!confirm('경고: 전체 설정 백업본으로 보입니다.\n\n이 데이터를 불러오면 "모든 폴더"의 숨김 설정과 순서가\n이 파일의 내용으로 완전히 덮어씌워집니다.\n\n진행하시겠습니까?')) return;
        
        const fixItems = (items) => {
            if (!Array.isArray(items)) return [];
            return items.map(item => {
                if (item.type === 'char') {
                    let found = characters.find(c => c.avatar === item.id);
                    if (!found) {
                        let guessName = item.id;
                        if (guessName.includes('_') && !guessName.includes('.')) {
                            guessName = guessName.substring(0, guessName.lastIndexOf('_'));
                        }
                        found = characters.find(c => c.name === guessName || c.name === item.id);
                    }
                    if (found) {
                        return { type: 'char', id: found.avatar }; 
                    }
                }
                return item;
            });
        };

        if (parsed.toc) {
            for (const key in parsed.toc) {
                if (parsed.toc[key].items) {
                    parsed.toc[key].items = fixItems(parsed.toc[key].items);
                }
            }
        }

        settings = parsed;
        extension_settings[extensionName] = settings;
        saveSettingsDebounced();

        $('#folder_hider_enable_toggle').prop('checked', settings.enabled);
        renderHiddenFolderList();
        hideFoldersOnListUpdate(); 
        
        alert('전체 설정 불러오기 완료.');

    } catch (e) {
        console.error(e);
        alert('설정 형식이 잘못되었습니다. JSON 형식이 맞는지 확인해주세요.');
    }
}

// =========================================================================
// 5. Logic: Persona Folder Management
// =========================================================================

let currentPersonaFolder = 'All'; 

function initPersonaExtension() {
    if (!settings.persona_folders) {
        settings.persona_folders = {};
    }
    
    if (settings.last_persona_folder) {
        currentPersonaFolder = settings.last_persona_folder;
    }

    settings.persona_folders = settings.persona_folders || {};
    saveSettingsDebounced();

    let retryCount = 0;
    const maxRetries = 60;

    const initCheckInterval = setInterval(() => {
        const $avatarBlock = $('#user_avatar_block');
        
        if ($avatarBlock.length > 0) {
            clearInterval(initCheckInterval);
            injectPersonaUI();
            connectPersonaObserver();
        } 
        
        retryCount++;
        if (retryCount > maxRetries) {
            clearInterval(initCheckInterval);
            console.log("[FolderHider] Persona block not found, initialization stopped.");
        }
    }, 500);
}

function injectPersonaUI() {
    const $personaBlock = $('#PersonaManagement');
    const $leftCol = $personaBlock.find('.persona_management_left_column');
    const $avatarBlock = $personaBlock.find('#user_avatar_block');
    const $searchBarContainer = $personaBlock.find('#persona_search_bar').parent();

    if ($('#persona_folder_bar').length === 0) {
        const $folderBar = $(`<div id="persona_folder_bar"></div>`);
        $folderBar.insertBefore($avatarBlock);
        renderPersonaTabs();
    }

    if ($('#persona_bulk_manage_btn').length === 0) {
        const $manageBtn = $(`
            <div id="persona_bulk_manage_btn" class="menu_button menu_button_icon interactable" title="Persona Bulk Manager" tabindex="0">
                <i class="fa-solid fa-folder-tree"></i>
                <div>Manage</div>
            </div>
        `);
        $searchBarContainer.find('#create_dummy_persona').before($manageBtn);
        $manageBtn.click(openPersonaBulkManager);
    }
}

function renderPersonaTabs() {
    const $bar = $('#persona_folder_bar');
    $bar.empty();

    // 1. 기본 탭
    const allActive = currentPersonaFolder === 'All' ? 'active' : '';
    $bar.append(`<div class="persona-folder-tab ${allActive}" data-folder="All"><i class="fa-solid fa-layer-group"></i> 전체</div>`);

    // 2. 미분류 탭
    const uncActive = currentPersonaFolder === 'Uncategorized' ? 'active' : '';
    $bar.append(`<div class="persona-folder-tab ${uncActive}" data-folder="Uncategorized"><i class="fa-regular fa-folder"></i> 미분류</div>`);

    // 3. 사용자 정의 폴더 탭
    const folders = Object.keys(settings.persona_folders).sort();
    folders.forEach(folder => {
        const isActive = currentPersonaFolder === folder ? 'active' : '';
        $bar.append(`<div class="persona-folder-tab ${isActive}" data-folder="${folder}"><i class="fa-solid fa-folder"></i> ${folder}</div>`);
    });

    // 4. 편집 버튼
    $bar.append(`<div class="persona-folder-settings-btn" title="폴더 추가/삭제"><i class="fa-solid fa-gear"></i></div>`);

    $bar.find('.persona-folder-tab').click(function() {
        currentPersonaFolder = $(this).data('folder');

        settings.last_persona_folder = currentPersonaFolder;
        saveSettingsDebounced();

        renderPersonaTabs(); 
        applyPersonaFolderFilter();
    });

    $bar.find('.persona-folder-settings-btn').click(openFolderEditPrompt);

    const barEl = $bar[0];
    if (!barEl._fhDragScrollBound) {
        barEl._fhDragScrollBound = true;
        let isDragging = false;
        let startX = 0;
        let startScrollLeft = 0;
        let didDrag = false;

        $bar.on('mousedown.fhscroll', function(e) {
            if ($(e.target).hasClass('persona-folder-tab') || $(e.target).closest('.persona-folder-tab').length) {
                isDragging = true;
                didDrag = false;
                startX = e.pageX;
                startScrollLeft = barEl.scrollLeft;
                $bar.css('cursor', 'grabbing');
                e.preventDefault();
            }
        });

        $(document).on('mousemove.fhscroll', function(e) {
            if (!isDragging) return;
            const dx = e.pageX - startX;
            if (Math.abs(dx) > 3) didDrag = true;
            barEl.scrollLeft = startScrollLeft - dx;
        });

        $(document).on('mouseup.fhscroll', function() {
            if (!isDragging) return;
            isDragging = false;
            $bar.css('cursor', '');
            if (didDrag) {
                $bar.one('click.fhscrollblock', function(e) {
                    e.stopImmediatePropagation();
                });
            }
        });
    }
}
function openFolderEditPrompt() {
    const action = prompt("동작을 선택하세요:\n1. 폴더 추가\n2. 폴더 이름 변경\n3. 폴더 삭제", "1");
    if (!action) return;

    if (action === "1") {
        const newName = prompt("새 폴더 이름 입력:");
        if (newName && !settings.persona_folders[newName]) {
            settings.persona_folders[newName] = [];
            saveSettingsDebounced();
            renderPersonaTabs();
        } else if (settings.persona_folders[newName]) {
            alert("이미 존재하는 폴더입니다.");
        }
    } else if (action === "2") {
        const folders = Object.keys(settings.persona_folders);
        if (folders.length === 0) return alert("수정할 폴더가 없습니다.");
        
        const oldName = prompt(`이름을 변경할 폴더명을 정확히 입력하세요:\n(${folders.join(', ')})`);
        if (oldName && settings.persona_folders[oldName]) {
            const newName = prompt("새 이름 입력:", oldName);
            if (newName && newName !== oldName) {
                settings.persona_folders[newName] = settings.persona_folders[oldName];
                delete settings.persona_folders[oldName];
                if (currentPersonaFolder === oldName) currentPersonaFolder = newName;
                saveSettingsDebounced();
                renderPersonaTabs();
            }
        }
    } else if (action === "3") {
        const folders = Object.keys(settings.persona_folders);
        if (folders.length === 0) return alert("삭제할 폴더가 없습니다.");

        const target = prompt(`삭제할 폴더명을 정확히 입력하세요 (내용물은 '전체/미분류'로 돌아갑니다):\n(${folders.join(', ')})`);
        if (target && settings.persona_folders[target]) {
            if (confirm(`정말 [${target}] 폴더를 삭제하시겠습니까?`)) {
                delete settings.persona_folders[target];
                if (currentPersonaFolder === target) currentPersonaFolder = 'All';
                saveSettingsDebounced();
                renderPersonaTabs();
                applyPersonaFolderFilter();
            }
        }
    }
}

function connectPersonaObserver() {
    const target = document.getElementById('user_avatar_block');

    if (!target) return; 

    if (personaListObserver) personaListObserver.disconnect();

    personaListObserver = new MutationObserver((mutations) => {
        applyPersonaFolderFilter();
    });

    personaListObserver.observe(target, { childList: true, subtree: false });
    
    applyPersonaFolderFilter();
}

function applyPersonaFolderFilter() {
    const $avatars = $('#user_avatar_block .avatar-container');
    
    if (currentPersonaFolder === 'All') {
        $avatars.removeClass(HIDDEN_CLASS);
        return;
    }

    const folderItems = settings.persona_folders[currentPersonaFolder] || [];
    const allCategorized = new Set();
    Object.values(settings.persona_folders).forEach(list => list.forEach(id => allCategorized.add(id)));

    $avatars.each(function() {
        const $el = $(this);
        const id = $el.attr('data-avatar-id');

        let shouldShow = false;

        if (currentPersonaFolder === 'Uncategorized') {
            if (!allCategorized.has(id)) shouldShow = true;
        } else {
            if (folderItems.includes(id)) shouldShow = true;
        }

        if (shouldShow) {
            $el.removeClass(HIDDEN_CLASS);
        } else {
            $el.addClass(HIDDEN_CLASS);
        }
    });
}

// =========================================================================
// 6. Logic: Persona Bulk Manager Popup
// =========================================================================

function openPersonaBulkManager() {
    const $overlay = $('<div class="toc-manager-overlay" id="persona_manager_popup"></div>');
    const folderOptions = Object.keys(settings.persona_folders).map(f => `<option value="${f}">${f}</option>`).join('');
    
const popupHtml = `
        <div class="toc-manager-modal" id="pm_modal_inner" style="max-width: 750px;">
            <div class="toc-header" style="display:flex; align-items:center; justify-content:space-between; padding: 18px 24px; border-bottom: 1px solid var(--fh-border);">
                <span style="font-size:1.1rem; font-weight:700; letter-spacing:-0.3px;">페르소나 폴더 일괄 관리</span>
                <i class="fa-solid fa-xmark close-popup-btn" style="cursor:pointer; font-size:1.2rem; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"></i>
            </div>
            
            <div class="toc-toolbar" style="padding: 16px 24px; border-bottom: 1px solid var(--fh-border); display:flex; flex-direction:column; gap:10px;">
                <div class="toc-toolbar-row" style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="pm_search_input" placeholder="이름 및 정보 검색..." style="flex:1; padding: 8px 12px; border-radius:8px; font-size:0.9rem;">
                    <select id="pm_filter_lang" style="min-width: 110px; padding: 8px 10px; border-radius:8px; font-size:0.9rem;">
                        <option value="">(모든 언어)</option>
                        <option value="ko">한국어</option>
                        <option value="ja">일본어</option>
                        <option value="zh">중국어</option>
                        <option value="en">영어</option>
                        <option value="other">기타</option>
                    </select>
                    <select id="pm_filter_folder" style="padding: 8px 10px; border-radius:8px; font-size:0.9rem;">
                        <option value="">(모든 위치)</option>
                        <option value="__uncategorized__">미분류만</option>
                        ${folderOptions}
                    </select>
                </div>
                <div class="toc-toolbar-row" style="display:flex; justify-content: space-between; align-items:center; gap:10px;">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <button id="pm_select_all" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">전체선택</button>
                        <button id="pm_deselect_all" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">해제</button>
                        <div style="width:1px; height:20px; background:var(--fh-border); margin:0 4px;"></div>
                        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:600; font-size:0.9rem; color:var(--fh-text); opacity:0.8;">
                            <input type="checkbox" id="pm_toggle_images"> 🖼️ 이미지 표시
                        </label>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="font-size:0.9rem; opacity:0.7; white-space:nowrap;">선택항목을:</span>
                        <select id="pm_target_folder" style="min-width:130px; padding: 7px 10px; border-radius:8px; font-size:0.9rem;">
                            <option value="">(이동할 폴더)</option>
                            ${folderOptions}
                            <option value="__remove__">[폴더에서 제거/미분류]</option>
                        </select>
                        <button id="pm_execute_move" class="lavender-btn" style="width: auto; padding: 7px 18px; font-size:0.9rem; white-space:nowrap;">이동 적용</button>
                    </div>
                </div>
            </div>

            <div class="toc-body" id="pm_list_body" style="padding: 16px 24px; overflow-y:auto;">
                <!-- 리스트 주입됨 -->
            </div>
            
            <div class="toc-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:10px; padding: 14px 24px; border-top: 1px solid var(--fh-border);">
                <small style="margin-right:auto; color:var(--fh-text); opacity:0.55; font-size:0.82rem;">* 변경 사항은 즉시 저장되며, 폴더를 이동합니다.</small>
                <button class="lavender-btn close-popup-btn" style="width: auto; padding: 7px 22px; font-size:0.9rem;">닫기</button>
            </div>
        </div>
    `;

    $overlay.html(popupHtml);
    $overlay.on('mousedown click pointerdown', function(e) {
        e.stopPropagation();
    });
    $('body').append($overlay);

    const $modal = $overlay.find('#pm_modal_inner');

    function updatePopupPosition() {
        if ($modal.length === 0) return;
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            const $chat = $('#chat');
            $overlay.css({ 'display': 'block', 'padding': '0' });
            
            if ($chat.length > 0) {
                const rect = $chat[0].getBoundingClientRect();
                $modal.css({
                    'position': 'fixed', 
                    'top': rect.top + 'px', 
                    'height': rect.height + 'px',
                    'left': '50%', 
                    'transform': 'translateX(-50%)', 
                    'width': '98%',
                    'max-width': 'unset', 
                    'max-height': 'unset', 
                    'border-radius': '12px', 
                    'margin': '0'
                });
            }
        } else {
            $overlay.css({ 'display': 'flex', 'padding': '' });
            $modal.css({
                'position': 'relative', 
                'top': '', 
                'left': '', 
                'transform': '', 
                'width': '90%',
                'height': '', 
                'max-width': '750px', 
                'max-height': '85vh', 
                'margin': ''
            });
        }
    }

    updatePopupPosition();
    $(window).on('resize.pmManager', updatePopupPosition);

    const close = () => {
        $(window).off('resize.pmManager'); 
        $overlay.remove();
        renderPersonaTabs(); 
        applyPersonaFolderFilter(); 
    };
    $overlay.find('.close-popup-btn').click(close);

    const allPersonas = [];
    $('#user_avatar_block .avatar-container').each(function() {
        const id = $(this).attr('data-avatar-id');
        const name = $(this).find('.ch_name').text().trim();
        const addInfo = $(this).find('.ch_additional_info').text().trim();
        const imgSrc = $(this).find('.avatar img').attr('src');
        
        let cleanName = name.replace(/^[\s\p{P}\p{S}]+/u, ''); 
        const firstChar = cleanName.charAt(0) || name.charAt(0); 

        let lang = 'other';
        if (/[가-힣]/.test(firstChar)) lang = 'ko'; 
        else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(firstChar)) lang = 'ja'; 
        else if (/[\u4E00-\u9FFF]/.test(firstChar)) lang = 'zh'; 
        else if (/[a-zA-Z]/.test(firstChar)) lang = 'en'; 

        let myFolders = [];
        for (const [fName, fList] of Object.entries(settings.persona_folders)) {
            if (fList.includes(id)) myFolders.push(fName);
        }

        allPersonas.push({ id, name, addInfo, imgSrc, lang, folders: myFolders, _el: this });
    });

    const renderList = () => {
        const $list = $('#pm_list_body');
        $list.empty();
        
        const searchQuery = $('#pm_search_input').val().toLowerCase();
        const filterFolder = $('#pm_filter_folder').val();
        const filterLang = $('#pm_filter_lang').val();
        const showImages = $('#pm_toggle_images').is(':checked');

        allPersonas.forEach((p, idx) => {
            if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.addInfo.toLowerCase().includes(searchQuery)) return;
            if (filterLang && p.lang !== filterLang) return;
            
            if (filterFolder === '__uncategorized__') {
                if (p.folders.length > 0) return;
            } else if (filterFolder && filterFolder !== '') {
                if (!p.folders.includes(filterFolder)) return;
            }

            const folderBadges = p.folders.map(f => `<span class="persona-folder-badge"><i class="fa-solid fa-folder" style="margin-right:3px;"></i>${f}</span>`).join('');
            const isSelected = p._selected ? 'selected' : '';
            const checked = p._selected ? 'checked' : '';
            
            const imgHtml = showImages && p.imgSrc ? `<img src="${p.imgSrc}" class="pm-avatar-img" alt="avatar">` : '';
            const addInfoHtml = p.addInfo ? `<span class="pm-add-info">${p.addInfo}</span>` : '';

            const itemHtml = `
                <div class="toc-item ${isSelected}" data-idx="${idx}" style="padding: 8px 10px;">
                    <input type="checkbox" class="toc-item-checkbox" ${checked}>
                    ${imgHtml}
                    <div style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
                        <div class="pm-name-block">
                            <span class="toc-item-name" style="font-weight:700; font-size:1.05em; color:var(--fh-text);">${p.name}</span>
                            ${addInfoHtml}
                            <div style="margin-left:auto; display:flex; gap:4px;">${folderBadges}</div>
                        </div>
                    </div>
                </div>
            `;
            $list.append(itemHtml);
        });

        $list.find('.toc-item').click(function(e) {
            if ($(e.target).is('input')) return;
            const idx = $(this).data('idx');
            allPersonas[idx]._selected = !allPersonas[idx]._selected;
            $(this).toggleClass('selected');
            $(this).find('.toc-item-checkbox').prop('checked', allPersonas[idx]._selected);
        });
        
        $list.find('.toc-item-checkbox').change(function() {
            const $item = $(this).closest('.toc-item');
            const idx = $item.data('idx');
            allPersonas[idx]._selected = $(this).is(':checked');
            $item.toggleClass('selected', allPersonas[idx]._selected);
        });
    };

    $('#pm_search_input').on('input', renderList);
    $('#pm_filter_folder, #pm_filter_lang').change(renderList);
    $('#pm_toggle_images').change(renderList);
    
    $('#pm_select_all').click(() => {
        $('#pm_list_body .toc-item').each(function() {
            const idx = $(this).data('idx');
            allPersonas[idx]._selected = true;
        });
        renderList();
    });
    
    $('#pm_deselect_all').click(() => {
        allPersonas.forEach(p => p._selected = false);
        renderList();
    });

    $('#pm_execute_move').click(() => {
        const targetFolder = $('#pm_target_folder').val();
        if (!targetFolder) return alert("이동할 대상 폴더를 선택하세요.");

        const selectedItems = allPersonas.filter(p => p._selected);
        if (selectedItems.length === 0) return alert("선택된 페르소나가 없습니다.");

        let count = 0;
        
        if (targetFolder === '__remove__') {
            selectedItems.forEach(p => {
                let changed = false;
                for (const fName in settings.persona_folders) {
                    const list = settings.persona_folders[fName];
                    const idx = list.indexOf(p.id);
                    if (idx !== -1) {
                        list.splice(idx, 1);
                        changed = true;
                    }
                }
                if (changed) {
                    p.folders = [];
                    count++;
                }
                p._selected = false;
            });
        } else {
            selectedItems.forEach(p => {
                for (const fName in settings.persona_folders) {
                    const list = settings.persona_folders[fName];
                    const idx = list.indexOf(p.id);
                    if (idx !== -1) list.splice(idx, 1);
                }
                
                if (!settings.persona_folders[targetFolder].includes(p.id)) {
                    settings.persona_folders[targetFolder].push(p.id);
                }
                
                p.folders = [targetFolder];
                p._selected = false;
                count++;
            });
        }

        saveSettingsDebounced();
        renderList(); 
        alert(`${count}개의 페르소나가 처리되었습니다.`);
    });

    renderList();
}

// =========================================================================
// Main Initialization
// =========================================================================
function onEnableToggle() {
    settings.enabled = $('#folder_hider_enable_toggle').prop('checked');
    hideFoldersOnListUpdate(); 
    saveSettingsDebounced();
}

function onAddFolder() {
    const folderName = $('#folder_name_input').val().trim();
    if (!folderName) { alert('입력값이 없습니다.'); return; }
    if (settings.hiddenFolders.includes(folderName)) { alert('이미 존재합니다.'); return; }
    
    settings.hiddenFolders.push(folderName);
    $('#folder_name_input').val(''); 
    saveSettingsDebounced();
    hideFoldersOnListUpdate(); 
    renderHiddenFolderList(); 
}

function onRemoveFolder() {
    const folderName = $(this).data('name');
    if (confirm(`폴더 [${folderName}] 삭제 및 숨김 해제?`)) {
        settings.hiddenFolders = settings.hiddenFolders.filter(n => n !== folderName);
        saveSettingsDebounced();
        hideFoldersOnListUpdate(); 
        renderHiddenFolderList(); 
    }
}

function renderHiddenFolderList() {
    const $container = $('#hidden_folder_list_container');
    $container.empty();
    const folders = settings.hiddenFolders;
    $('#hidden_folder_count').text(folders.length);
    
    if (folders.length === 0) {
        $container.append('<div class="placeholder">숨김 처리된 폴더가 없습니다.</div>'); 
        return;
    }
    folders.forEach(name => {
        $container.append(`
            <div class="folder-list-item">
                <span class="folder-name">${name}</span>
                <button class="delete-btn" data-name="${name}"><i class="fa-solid fa-trash-can"></i>삭제</button>
            </div>
        `);
    });
    $container.find('.delete-btn').click(onRemoveFolder);
}

(async function() {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);
        
        $('#theme_selector_container').html(themeManager.getPaletteHTML(settings.theme));
        themeManager.bindPaletteEvents();

        $('.fh-tab-btn').click(function() {
            const targetId = $(this).data('tab');
            
            $('.fh-tab-btn').removeClass('active');
            $(this).addClass('active');

            $('.fh-tab-content').removeClass('active');
            $(`#${targetId}`).addClass('active');
        });

        $('#folder_hider_enable_toggle').prop('checked', settings.enabled).change(onEnableToggle);
        $('#add_folder_btn').click(onAddFolder);
        $('#folder_name_input').keydown(e => { if(e.key==='Enter') onAddFolder(); });
        
        $('#open_toc_manager_btn').click(renderTocManagerPopup);
        
        $('#export_settings_btn').click(onExportSettings);
        $('#import_settings_btn').click(onImportSettings);

        renderHiddenFolderList();
    } catch (e) {
        console.error(`[${extensionName}] Init Error:`, e);
    }

    injectCssRules(); 
    injectJumpButton(); 
    addTocButton();
    connectObserver();
    themeManager.init(settings.theme);
	
    // 다음 업데이트 때: CURRENT_NOTICE_ID를 v2로 바꾸고, CURRENT_NOTICE_HTML에 새 내용을 적기만 하면 됩니다.
    const CURRENT_NOTICE_ID = 'patch_2026_01_fix_v1'; 

    // 이번 공지사항의 내용 (HTML 태그 사용 가능)
    const CURRENT_NOTICE_HTML = `
        <p>
            최근 <b>폴더 간 목차 꼬임 현상</b> 및 <b>백업 오류</b>가 수정되었습니다.<br>
            이전 버전에서 목차가 섞였다면, <b>[목차/순서 설정]</b> 탭에서 
            <b>'초기화'</b> 버튼을 눌러 정리한 뒤 다시 설정해주시기 바랍니다.
        </p>
    `;

    if (settings.last_notice_id !== CURRENT_NOTICE_ID) {
        $('#update_notice_text_area').html(CURRENT_NOTICE_HTML);
        $('#update_notice_box').slideDown();
        $('#close_update_notice_btn').off('click').on('click', function() {
            $('#update_notice_box').slideUp();
            settings.last_notice_id = CURRENT_NOTICE_ID; 
            saveSettingsDebounced();
        });
    }

    hideFoldersOnListUpdate(); 

    initPersonaExtension();

})();