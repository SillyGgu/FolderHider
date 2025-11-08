import {
    
    
    saveSettingsDebounced
} from '../../../../script.js';

import { 
    extension_settings
} from '../../../extensions.js'; 




const extensionName = 'FolderHider';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const STYLE_ID = 'folder-hider-css-rules';
const HIDDEN_CLASS = 'folder-hider-js-hidden'; 




const DEFAULT_SETTINGS = {
    enabled: true,
    hiddenFolders: [], 
};

let settings = extension_settings[extensionName];

if (!settings || Object.keys(settings).length === 0) {
    settings = Object.assign({}, DEFAULT_SETTINGS);
    extension_settings[extensionName] = settings;
    saveSettingsDebounced();
} else {
    settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    extension_settings[extensionName] = settings;
}



function injectHidingCssClass() {
    $(`#${STYLE_ID}`).remove();
    
    const staticCss = `
        
        .${HIDDEN_CLASS} {
            display: none !important;
        }
    `;
    
    const $style = $(`<style id="${STYLE_ID}">`).text(staticCss);
    $('head').append($style);
}


function hideFoldersOnListUpdate() {
    const $characterBlock = $('#rm_print_characters_block');
    const isSubFolderView = $characterBlock.find('#BogusFolderBack').length > 0;
    
    
    
    $characterBlock.find('.bogus_folder_select').removeClass(HIDDEN_CLASS);

    
    if (!settings.enabled || settings.hiddenFolders.length === 0) {
        return;
    }

    
    const hiddenTitles = settings.hiddenFolders.map(name => `[Folder] ${name.replace(/"/g, '\\"')}`);

    
    if (!isSubFolderView) {
        
        
        $characterBlock.find('div.bogus_folder_select').each(function() {
            const $folderOrChar = $(this);
            
            const title = $folderOrChar.find('span.ch_name').attr('title');

            
            if (title && hiddenTitles.includes(title)) {
                
                $folderOrChar.addClass(HIDDEN_CLASS);
            }
            
            
        });
    }
}







function renderHiddenFolderList() {
    const $container = $('#hidden_folder_list_container');
    $container.empty();
    
    const folders = settings.hiddenFolders;
    
    $('#hidden_folder_count').text(folders.length);
    
    if (folders.length === 0) {
        $container.append('<div class="placeholder" id="folder_list_placeholder">숨김 처리된 폴더가 없습니다.</div>'); 
        return;
    }

    folders.forEach(folderName => {
        const itemHtml = `
            <div class="folder-list-item" data-name="${folderName}">
                <span class="folder-name">${folderName}</span>
                <button class="delete-btn" data-name="${folderName}" title="목록에서 제거하고 숨김 해제">
                    <i class="fa-solid fa-trash-can"></i>삭제
                </button>
            </div>
        `;
        $container.append(itemHtml);
    });

    $container.find('.delete-btn').off('click').on('click', onRemoveFolder);
}

function onEnableToggle() {
    settings.enabled = $('#folder_hider_enable_toggle').prop('checked');
    hideFoldersOnListUpdate(); 
    saveSettingsDebounced();
}

function onAddFolder() {
    const folderName = $('#folder_name_input').val().trim();

    if (!folderName) {
        alert('숨길 폴더 이름을 입력해주세요.');
        return;
    }

    if (settings.hiddenFolders.includes(folderName)) {
        alert(`폴더 [${folderName}]은(는) 이미 숨김 목록에 있습니다.`);
        return;
    }

    settings.hiddenFolders.push(folderName);
    $('#folder_name_input').val(''); 

    saveSettingsDebounced();
    hideFoldersOnListUpdate(); 
    renderHiddenFolderList(); 

    alert(`폴더 [${folderName}]이(가) 숨김 목록에 추가되었습니다. 캐릭터 목록을 확인하세요.`);
}

function onRemoveFolder() {
    const folderName = $(this).data('name');
    
    if (confirm(`폴더 [${folderName}]의 숨김 처리를 해제하고 목록에서 삭제하시겠습니까?`)) {
        
        settings.hiddenFolders = settings.hiddenFolders.filter(name => name !== folderName);
        
        saveSettingsDebounced();
        hideFoldersOnListUpdate(); 
        renderHiddenFolderList(); 

        alert(`폴더 [${folderName}]의 숨김 처리가 해제되었습니다.`);
    }
}






(async function() {
    
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
		$("#extensions_settings2").append(settingsHtml);
        
        
        $('#folder_hider_enable_toggle').prop('checked', settings.enabled).on('change', onEnableToggle);
        
        $('#add_folder_btn').on('click', onAddFolder);
        $('#folder_name_input').on('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                onAddFolder();
            }
        });
        
        
        renderHiddenFolderList();
        
    } catch (error) {
        console.error(`[${extensionName}] Failed to load settings.html:`, error);
    }

    
    
    
    injectHidingCssClass(); 
    
    
    const characterBlock = document.getElementById('rm_print_characters_block');
    
    if (characterBlock) {
        const observer = new MutationObserver(hideFoldersOnListUpdate);
        
        
        observer.observe(characterBlock, { 
            childList: true, 
            subtree: false 
        });

        console.log(`[${extensionName}] Mutation Observer가 캐릭터 목록 DOM 변경 감시를 시작했습니다.`);
    } else {
        console.warn(`[${extensionName}] '#rm_print_characters_block' 요소를 찾을 수 없습니다. 폴더 숨김 기능이 정상 작동하지 않을 수 있습니다.`);
    }
    
    
    hideFoldersOnListUpdate(); 

})();