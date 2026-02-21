import {
    saveSettingsDebounced,
    entitiesFilter
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

        /* 구분선(Divider) 스타일 강화 */
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
        
        /* 리스트 아이템 스타일 */
        .toc-item {
            display: flex; align-items: center; padding: 6px 8px; background: #fff;
            border: 1px solid #ddd; margin-bottom: 5px; border-radius: 6px;
            transition: all 0.2s;
        }
        .toc-item.type-header { background: #fff5eb; border-color: #ffd8a8; font-weight: bold; }
        .toc-item.type-folder { background: #eef; }
        
        /* 숨김 처리된 아이템 시각화 */
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
        .toc-controls { display: flex; gap: 4px; margin-left: 10px; }
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

    const activeFolderTag = selectedTags
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

        if ($el.hasClass('character_select')) {
            type = 'char';
            id = $el.attr('data-chid');
            name = $el.find('.ch_name').text().trim();
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
            items.push({ type, id, name, tags, $el }); 
        }
    });
    return items;
}

// =========================================================================
// 3. Logic: DOM 재배치 (Fluidity 대응)
// =========================================================================

function connectObserver() {
    const target = document.getElementById('rm_print_characters_block');
    if (target && !mainListObserver) {
        mainListObserver = new MutationObserver((mutations) => {
            hideFoldersOnListUpdate();
        });
        mainListObserver.observe(target, { childList: true });
    }
}

function disconnectObserver() {
    if (mainListObserver) {
        mainListObserver.disconnect();
        mainListObserver = null;
    }
}

function applyTocOrderToDom($container) {
    if (!settings.enabled) return;

    disconnectObserver();

    const contextId = getCurrentContextId();
    const tocConfig = settings.toc[contextId];

    if (!tocConfig || !tocConfig.items || tocConfig.items.length === 0) {
        $container.find('.char-list-separator').remove();
        connectObserver(); 
        return;
    }

    const currentItems = getDomItems($container);
    const itemMap = {}; 
    currentItems.forEach(item => {
        itemMap[`${item.type}_${item.id}`] = item.$el;
        item.$el.detach(); 
    });

    $container.find('.char-list-separator').remove();

    const $backBtn = $container.find('#BogusFolderBack');
    if ($backBtn.length) {
        $backBtn.detach();
        $container.append($backBtn);
    }

    const excludeFolders = tocConfig.excludeFolders;
    const processedKeys = new Set();

    // (A) 폴더 제외 모드: 폴더를 먼저 상단에 배치
    if (excludeFolders) {
        currentItems.forEach(item => {
            if (item.type === 'folder') {
                const key = `folder_${item.id}`;
                if (itemMap[key]) {
                    $container.append(itemMap[key]);
                    processedKeys.add(key);
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

            const key = `${confItem.type}_${confItem.id}`;
            const $el = itemMap[key];
            if ($el) {
                $container.append($el);
                processedKeys.add(key);
            }
        }
    });

    // (C) 유동성 대응
    currentItems.forEach(item => {
        const key = `${item.type}_${item.id}`;
        if (!processedKeys.has(key)) {
            const $el = itemMap[key];
            if ($el) {
                $container.append($el);
            }
        }
    });

    // (D) 히든 카운터 블록 맨 뒤로
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
    const isFolderView = contextId.startsWith('folder_');
    const contextName = isFolderView 
        ? (tags.find(t => 'folder_' + t.id === contextId)?.name || '폴더 내부 뷰') 
        : '메인 목록 (Root)';

    const savedConfig = settings.toc[contextId] || { excludeFolders: true, items: [] };
    const $container = $('#rm_print_characters_block');
    const currentItems = getDomItems($container);

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

    if (savedConfig.items) {
        savedConfig.items.forEach(confItem => {
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

    const popupHtml = `
        <div class="toc-manager-overlay" id="toc_manager_popup">
            <div class="toc-manager-modal" id="toc_manager_modal_inner">
                <div class="toc-header">
                    <span>${contextName} - 목차 관리</span>
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
                    <!-- 초기화 버튼: 색상 변경 및 명확한 라벨 -->
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
            const titleAttr = (item.type === 'char' && item.tags) ? `Tags: ${item.tags.join(', ')}` : '';

            const html = `
                <div class="toc-item ${isHeader ? 'type-header' : 'type-' + item.type} ${hiddenClass}" data-index="${index}">
                    <input type="checkbox" class="toc-item-checkbox" ${isChecked}>
                    <i class="fa-solid ${iconClass}"></i>
                    <span class="toc-item-name" ${isHeader ? 'contenteditable="true"' : ''} title="${titleAttr}">${name}</span>
                    <div class="toc-controls">
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
        $('.toc-item-checkbox').change(function() {
            workingList[$(this).closest('.toc-item').data('index')]._selected = $(this).is(':checked');
        });
        $list.find('.toc-btn.up').click(function() {
            const idx = $(this).closest('.toc-item').data('index');
            if (idx > 0) { [workingList[idx], workingList[idx-1]] = [workingList[idx-1], workingList[idx]]; renderList(); }
        });
        $list.find('.toc-btn.down').click(function() {
            const idx = $(this).closest('.toc-item').data('index');
            if (idx < workingList.length - 1) { [workingList[idx], workingList[idx+1]] = [workingList[idx+1], workingList[idx]]; renderList(); }
        });
        $list.find('.toc-btn.del').click(function() {
            if (confirm('이 구분선을 삭제하시겠습니까?')) { workingList.splice($(this).closest('.toc-item').data('index'), 1); renderList(); }
        });
        $list.find('.toc-item-name[contenteditable]').on('blur', function() {
            const idx = $(this).closest('.toc-item').data('index');
            const newText = $(this).text().replace('[구분선] ', '').trim();
            if (workingList[idx].type === 'header') workingList[idx].text = newText;
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
        if(confirm('이 폴더(목록)의 순서 변경 내역을 삭제하고 기본 상태로 되돌리시겠습니까?\n\n(구분선과 사용자 지정 순서가 모두 사라집니다)')) {
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
            folderName: contextName 
        };
        saveSettingsDebounced();
        
        hideFoldersOnListUpdate();
        closePopup();
        alert('목차 순서가 저장 및 적용되었습니다.');
    });
}

function onExportSettings() {
    const jsonStr = JSON.stringify(settings, null, 2);
    $('#setting_backup_area').val(jsonStr);
}

function onImportSettings() {
    const jsonStr = $('#setting_backup_area').val().trim();
    if (!jsonStr) { alert('가져올 설정 내용이 없습니다.'); return; }

    if (!confirm('현재 설정을 백업된 내용으로 덮어씌웁니다.\n\n* 중요: 폴더 ID가 다른 경우, 저장된 "폴더 이름"을 기준으로 자동으로 매칭을 시도합니다.')) return;

    try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed.enabled === 'undefined') throw new Error('올바르지 않은 설정 포맷 (enabled 누락)');
        
        if (!parsed.toc || typeof parsed.toc !== 'object') parsed.toc = {};

        const newToc = {};
        for (const [key, val] of Object.entries(parsed.toc)) {
            if (key.startsWith('folder_')) {
                const oldId = key.replace('folder_', '');
                
                const exists = tags.some(t => t.id === oldId);
                
                if (exists) {
                    newToc[key] = val;
                } else if (val.folderName) {
                    const match = tags.find(t => t.name === val.folderName && t.folder_type);
                    if (match) {
                        console.log(`[FolderHider] 폴더 ID 변경 감지: "${val.folderName}" (${oldId} -> ${match.id})`);
                        newToc['folder_' + match.id] = val; 
                    } else {
                        newToc[key] = val;
                    }
                } else {
                    newToc[key] = val;
                }
            } else {

                newToc[key] = val;
            }
        }
        parsed.toc = newToc;

        settings = parsed;
        extension_settings[extensionName] = settings;
        saveSettingsDebounced();

        $('#folder_hider_enable_toggle').prop('checked', settings.enabled);
        renderHiddenFolderList();
        
        hideFoldersOnListUpdate(); 
        
        alert('설정을 성공적으로 불러왔습니다.\n(폴더 이름 기반 자동 매칭 완료)');
    } catch (e) {
        console.error(e);
        alert('설정 불러오기 실패:\nJSON 형식을 확인하세요.\n' + e.message);
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
    hideFoldersOnListUpdate(); 

})();