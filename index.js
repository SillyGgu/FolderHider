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

const extensionName = 'FolderHider';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const STYLE_ID = 'folder-hider-css-rules';
const HIDDEN_CLASS = 'folder-hider-js-hidden'; 

const DEFAULT_SETTINGS = {
    enabled: true,
    hiddenFolders: [], 
    toc: {} 
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
// =========================================================================
// 1. CSS Injection
// =========================================================================
function injectCssRules() {
    $(`#${STYLE_ID}`).remove();
    
    const staticCss = `
        .${HIDDEN_CLASS} {
            display: none !important;
        }

        .char-list-separator {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            margin: 20px 0 10px 0;
            padding: 5px 0;
            color: var(--smart-theme-body-color, #888);
            font-weight: bold;
            font-size: 0.9em;
            opacity: 0.9;
            pointer-events: none;
            position: relative;
            flex-shrink: 0;
            z-index: 5;
        }
        .char-list-separator::before,
        .char-list-separator::after {
            content: "";
            flex: 1;
            border-bottom: 2px solid var(--smart-theme-border-color, rgba(128,128,128,0.3));
            margin: 0 10px;
        }
        .char-list-separator span {
            background: var(--smart-theme-bg, transparent);
            padding: 4px 12px;
            border-radius: 12px;
            border: 1px solid var(--smart-theme-border-color, rgba(128,128,128,0.2));
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        /* 팝업 스타일 */
        .toc-manager-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Pretendard', sans-serif;
        }
        .toc-manager-modal {
            background: #fff; width: 90%; max-width: 600px; max-height: 85vh;
            border-radius: 12px; display: flex; flex-direction: column;
            overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); color: #333;
        }
        .toc-header {
            padding: 15px 20px; background: #e0e0f0; border-bottom: 1px solid #ccc;
            display: flex; justify-content: space-between; align-items: center; font-weight: bold;
        }
        
        /* 툴바 섹션 (Bulk Actions) */
        .toc-toolbar {
            padding: 10px; background: #f0f2f5; border-bottom: 1px solid #ddd;
            display: flex; flex-direction: column; gap: 8px;
            font-size: 0.85rem;
        }
        .toc-toolbar-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .toc-toolbar select, .toc-toolbar input {
            padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;
        }
        .toc-toolbar button {
            padding: 4px 10px; border: none; border-radius: 4px;
            background: #d9cff5; color: #3a2e5f; cursor: pointer; font-weight: 600;
        }
        .toc-toolbar button:hover { background: #c5b8e8; }

        .toc-body { flex: 1; overflow-y: auto; padding: 10px; background: #f8f8fc; }
        .toc-footer { padding: 15px; background: #fff; border-top: 1px solid #ddd; display: flex; gap: 10px; justify-content: flex-end; }
        
        .toc-item {
            display: flex; align-items: center; padding: 6px 8px; background: #fff;
            border: 1px solid #ddd; margin-bottom: 5px; border-radius: 6px;
            transition: all 0.1s;
            user-select: none;
            cursor: grab;
            position: relative;
            flex-wrap: nowrap; 
            height: auto;
        }
        .toc-item:active {
            cursor: grabbing;
        }
        
        .toc-btn.info {
            color: #0984e3; border-color: #74b9ff; background: #eaf4ff;
            position: relative; 
        }
        .toc-btn.info:hover {
            background: #dcefff;
            z-index: 100; 
        }

        .toc-tooltip {
            display: none;
            position: absolute;
            bottom: 30px;
            right: 0; 
            width: 280px;
            background: #fff;
            border: 1px solid #b2bec3;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            padding: 12px;
            border-radius: 8px;
            z-index: 9999;
            text-align: left;
            white-space: normal;
            pointer-events: none; /* 마우스 간섭 방지 */
            cursor: default;
        }
        
        /* 툴팁 화살표 */
        .toc-tooltip::after {
            content: "";
            position: absolute;
            top: 100%;
            right: 8px;
            border-width: 6px;
            border-style: solid;
            border-color: #fff transparent transparent transparent;
        }

        .toc-btn.info:hover .toc-tooltip {
            display: block;
            animation: fadeIn 0.2s ease;
        }

        .toc-tags-row { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #eee; }
        
        .toc-tag-pill {
            display: inline-block;
            background: #f1f2f6;
            border: 1px solid #dfe4ea;
            border-radius: 4px;
            padding: 1px 6px;
            margin: 0 4px 4px 0;
            font-size: 0.75rem;
            color: #57606f;
        }

        .toc-desc-text {
            color: #636e72;
            font-size: 0.85rem;
            line-height: 1.4;
            font-style: normal;
        }
        
        /* 드래그 앤 드롭 시각 효과 */
        .toc-item.dragging {
            opacity: 0.4;
            background: #f0f0f0;
            border: 2px dashed #9a86d3; 
            box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
        }

        .toc-item.drag-over {
            border-top: 3px solid #9a86d3 !important; 
            background: linear-gradient(to bottom, #f3f0ff, #fff);
            transform: translateY(2px); 
            opacity: 1 !important; 
        }

        .toc-item-name[contenteditable="true"] {
            user-select: text;
            cursor: text;
        }

        .toc-item.type-header { background: #fff5eb; border-color: #ffd8a8; font-weight: bold; }
        .toc-item.type-folder { background: #eef; }
        
        .toc-item.is-hidden {
            opacity: 0.6;
            background: #f0f0f0;
            border: 1px dashed #ccc;
        }
        .toc-item.is-hidden .toc-item-name::after {
            content: " (Hidden)";
            color: #d63031;
            font-size: 0.8em;
            margin-left: 5px;
            font-weight: bold;
        }

        .toc-item-checkbox { margin-right: 10px; transform: scale(1.2); cursor: pointer; }
        .toc-item-name { flex: 1; margin-left: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default; }
        .toc-controls { display: flex; gap: 4px; margin-left: 10px; align-items: center; }
        .toc-btn {
            border: 1px solid #ccc; background: #f0f0f0; border-radius: 4px;
            width: 24px; height: 24px; cursor: pointer;
            display: flex; justify-content: center; align-items: center; color: #555; font-size: 0.8rem;
        }
        .toc-btn:hover { background: #e0e0e0; }
        .toc-btn.del { color: #d63031; border-color: #fab1a0; background: #fff0f0; }
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

let observerTimeout = null;

function connectObserver() {
    const target = document.getElementById('rm_print_characters_block');
    if (target && !mainListObserver) {
        mainListObserver = new MutationObserver((mutations) => {
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

            if (observerTimeout) clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                hideFoldersOnListUpdate();
            }, 100);
        });
        mainListObserver.observe(target, { childList: true, subtree: false });
    }
}

function disconnectObserver() {
    if (mainListObserver) {
        mainListObserver.disconnect();
        mainListObserver = null;
    }
    if (observerTimeout) {
        clearTimeout(observerTimeout);
        observerTimeout = null;
    }
}

function applyTocOrderToDom($container) {
    if (!settings.enabled) return;

    disconnectObserver();

    const contextId = getCurrentContextId();
    
    // 1. 시각적으로 폴더 내부인지 확인
    const isVisuallyInFolder = $container.find('#BogusFolderBack').length > 0;

    if (contextId === 'root' && isVisuallyInFolder) {
        connectObserver();
        return;
    }

    const tocConfig = settings.toc[contextId];

    if (!tocConfig || !tocConfig.items || tocConfig.items.length === 0) {
        $container.find('.char-list-separator').remove();
        connectObserver(); 
        return;
    }

    const currentItems = getDomItems($container);
    
    // -------------------------------------------------------------------------
    // "현재 화면의 아이템"과 "적용하려는 목차"의 일치율 검사
    // -------------------------------------------------------------------------
    
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
            return;
        }
    }
    // -------------------------------------------------------------------------

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
            const $sep = $(`
                <div class="char-list-separator">
                    <span>${confItem.text}</span>
                </div>
            `);
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

    connectObserver();
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

    // =========================================================================
    // 팝업 안전장치: "설정"과 "화면"의 불일치 감지 시 설정 무시
    // =========================================================================
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
            console.warn(`[FolderHider] Context mismatch detected in Popup. Ignoring saved config for safety.`);
            workingConfigItems = []; 
            isConfigMismatch = true;
        }
    }
    // =========================================================================

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
                <div class="toc-header">
                    <span>${displayTitle}</span>
                    <i class="fa-solid fa-xmark close-toc-btn" style="cursor:pointer;"></i>
                </div>
                
                <div class="toc-toolbar">
                    <div class="toc-toolbar-row">
                        <button id="toc_select_all_btn">전체 선택</button>
                        <button id="toc_deselect_all_btn">선택 해제</button>
                        <div style="border-left:1px solid #ccc; height:20px; margin:0 5px;"></div>
                        <input type="text" id="toc_tag_filter_input" list="toc_tag_datalist" placeholder="태그 선택 또는 검색..." style="width:140px;">
                        <datalist id="toc_tag_datalist">${tagOptionsHtml}</datalist>
                        <button id="toc_select_by_tag_btn">태그로 선택</button>
                    </div>
                    <div class="toc-toolbar-row">
                        <span>선택한 항목을:</span>
                        <select id="toc_move_target_select" style="min-width:150px;">
                            <option value="">(이동할 구분선 선택)</option>
                        </select>
                        <button id="toc_move_execute_btn">▼ 여기로 이동</button>
                    </div>
                </div>

                <div class="toc-body" id="toc_items_list">
                    <div class="toc-checkbox-row">
                        <label>
                            <input type="checkbox" id="toc_exclude_folders" ${savedConfig.excludeFolders ? 'checked' : ''}>
                            폴더 제외하기 (폴더는 항상 맨 위에 고정, 정렬 제외)
                        </label>
                    </div>
                </div>
                <div class="toc-footer">
                    <button class="lavender-btn reset-toc-btn" style="width: auto; padding: 0 15px; background: #ff7675; color: #fff; margin-right: auto;">↻ 데이터 삭제(초기화)</button>
                    <button class="lavender-btn add-sep-btn" style="width: auto; padding: 0 15px;">+ 구분선 추가</button>
                    <button class="lavender-btn save-toc-btn" style="width: auto; padding: 0 15px; background: #a29bfe; color: #fff;">저장 및 적용</button>
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
        $list.find('.toc-item').remove();
        $targetSelect.find('option:not(:first)').remove(); 

        const excludeFolders = $('#toc_exclude_folders').is(':checked');
        const hiddenFolders = settings.hiddenFolders || [];

        workingList.forEach((item, index) => {
            if (excludeFolders && item.type === 'folder') return;

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

            const html = `
                <div class="toc-item ${isHeader ? 'type-header' : 'type-' + item.type} ${hiddenClass}" 
                     data-index="${index}" 
                     draggable="true">
                    <input type="checkbox" class="toc-item-checkbox" ${isChecked}>
                    <i class="fa-solid ${iconClass}"></i>
                    <span class="toc-item-name" ${isHeader ? 'contenteditable="true"' : ''}>${name}</span>
                    <div class="toc-controls">
                        ${infoBtnHtml}
                        <div class="toc-btn up"><i class="fa-solid fa-arrow-up"></i></div>
                        <div class="toc-btn down"><i class="fa-solid fa-arrow-down"></i></div>
                        ${isHeader ? '<div class="toc-btn del"><i class="fa-solid fa-trash"></i></div>' : ''}
                    </div>
                </div>
            `;
            $list.append(html);
        });

        $list.scrollTop(scrollTop);
        bindItemEvents();
    }

    function bindItemEvents() {
        $('.toc-item-checkbox').change(function(e) {
            workingList[$(this).closest('.toc-item').data('index')]._selected = $(this).is(':checked');
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
        $list.find('.toc-item-name[contenteditable]').on('blur', function() {
            const idx = $(this).closest('.toc-item').data('index');
            const newText = $(this).text().replace('[구분선] ', '').trim();
            if (workingList[idx].type === 'header') workingList[idx].text = newText;
        }).on('mousedown click', function(e) {
            $(this).closest('.toc-item').attr('draggable', 'false');
        }).on('blur', function() {
            $(this).closest('.toc-item').attr('draggable', 'true');
        });

        let draggedIndex = null;
        $list.find('.toc-item').on('dragstart', function(e) {
            if ($(e.target).is('input, button, .toc-btn, .toc-btn *, [contenteditable="true"]')) {
                e.preventDefault(); return;
            }
            draggedIndex = $(this).data('index');
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.setData('text/plain', draggedIndex); 
            if (workingList[draggedIndex]._selected) {
                $list.find('.toc-item').each(function() { if (workingList[$(this).data('index')]._selected) $(this).addClass('dragging'); });
            } else { $(this).addClass('dragging'); }
        });
        $list.find('.toc-item').on('dragend', function() { $('.toc-item').removeClass('dragging drag-over'); draggedIndex = null; });
        $list.find('.toc-item').on('dragover', function(e) {
            e.preventDefault(); e.originalEvent.dataTransfer.dropEffect = 'move';
            $('.toc-item').removeClass('drag-over');
            const idx = $(this).data('index');
            const isDraggingSelected = (draggedIndex !== null) && workingList[draggedIndex]._selected;
            if (isDraggingSelected && workingList[idx]._selected) return;
            $(this).addClass('drag-over');
        });
        $list.find('.toc-item').on('drop', function(e) {
            e.preventDefault(); $('.toc-item').removeClass('drag-over dragging');
            const droppedIndex = $(this).data('index');
            if (draggedIndex === null || draggedIndex === undefined) return;
            const droppedItem = workingList[droppedIndex]; 
            const isMultiDrag = workingList[draggedIndex]._selected;
            if (isMultiDrag) {
                if (droppedItem._selected) return;
                const itemsToMove = workingList.filter(item => item._selected);
                const remainingItems = workingList.filter(item => !item._selected);
                let newIndex = remainingItems.indexOf(droppedItem);
                if (newIndex !== -1) { remainingItems.splice(newIndex, 0, ...itemsToMove); workingList = remainingItems; renderList(); }
            } else if (draggedIndex !== droppedIndex) {
                const itemToMove = workingList[draggedIndex];
                const tempArray = [...workingList];
                tempArray.splice(draggedIndex, 1);
                let targetIndex = tempArray.indexOf(droppedItem);
                tempArray.splice(targetIndex, 0, itemToMove);
                workingList = tempArray; renderList();
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
    connectObserver(); 
	
    // 다음 업데이트 때: CURRENT_NOTICE_ID를 v2로 바꾸고, CURRENT_NOTICE_HTML에 새 내용을 적기만 하면 됩니다.
    const CURRENT_NOTICE_ID = 'patch_2026_01_fix_v1'; 

    // 2. 이번 공지사항의 내용 (HTML 태그 사용 가능)
    const CURRENT_NOTICE_HTML = `
        <p>
            최근 <b>폴더 간 목차 꼬임 현상</b> 및 <b>백업 오류</b>가 수정되었습니다.<br>
            이전 버전에서 목차가 섞였다면, <b>[목차/순서 설정]</b> 탭에서 
            <b>'초기화'</b> 버튼을 눌러 정리한 뒤 다시 설정해주시기 바랍니다.
        </p>
    `;

    // 3. 로직 실행
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

})();