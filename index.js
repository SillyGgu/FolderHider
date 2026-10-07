import {
    saveSettingsDebounced,
    entitiesFilter,
    characters,
    getThumbnailUrl,
    eventSource,
    event_types
} from '../../../../script.js';

import { 
    extension_settings
} from '../../../extensions.js'; 

import { tags, isBogusFolder } from '../../../../scripts/tags.js';
import { getUserAvatars } from '../../../../scripts/personas.js';
import { power_user } from '../../../../scripts/power-user.js';
import { escapeHtml, normalizeSettings, normalizeTocConfig } from './safety.mjs';
import { getStableIndices } from './stable-order.mjs';
import { bindManagerViewport, getManagerScrollElement } from './manager-viewport.mjs';

import {
    themeManager
} from './themes.js';

const extensionName = 'FolderHider';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const STYLE_ID = 'folder-hider-css-rules';
const HIDDEN_CLASS = 'folder-hider-js-hidden'; 
const COLLAPSED_CLASS = 'folder-hider-collapsed-hidden';
const PAGE_HIDDEN_CLASS = 'folder-hider-page-hidden';

const DEFAULT_SETTINGS = {
    enabled: true,
    hiddenFolders: [], 
    toc: {},
    collapsed_sections: {},
    persona_folders: {},
    persona_folder_order: [],
    last_persona_folder: 'All',
    toc_view_mode: 'card',
    persona_view_mode: 'card',
    theme: 'lavender' 
};

let settings = extension_settings[extensionName];
settings = normalizeSettings(settings || DEFAULT_SETTINGS);
extension_settings[extensionName] = settings;

let mainListObserver = null;
let personaListObserver = null;
let personaFilterRaf = null;
let personaAvatarIndex = null;
let visiblePersonaAvatars = null;

// =========================================================================
// 1. CSS Injection
// =========================================================================

function injectCssRules() {
    $(`#${STYLE_ID}`).remove();
    
    
    const staticCss = `
        .${HIDDEN_CLASS} {
            display: none !important;
        }
        .${COLLAPSED_CLASS} {
            display: none !important;
        }
        .${PAGE_HIDDEN_CLASS} {
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
            color: var(--SmartThemeBodyColor); flex-shrink: 0;
        }
        .persona-folder-settings-btn:hover { opacity: 1; color: var(--fh-accent); }

        .fh-folder-editor {
            width: min(92vw, 540px); max-height: min(88dvh, 700px);
            background: var(--fh-bg); color: var(--fh-text);
            border: 1px solid var(--fh-border); border-radius: 12px;
            display: flex; flex-direction: column; overflow: hidden;
            box-shadow: 0 12px 36px rgba(0,0,0,.3);
        }
        .fh-folder-editor-header, .fh-folder-editor-footer {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 14px 18px; flex: none;
        }
        .fh-folder-editor-header { background: var(--fh-secondary); border-bottom: 1px solid var(--fh-border); }
        .fh-folder-editor-footer { border-top: 1px solid var(--fh-border); justify-content: flex-end; }
        .fh-folder-editor-header strong { font-size: 1.05rem; }
        .fh-folder-editor-main { padding: 16px 18px; overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
        .fh-folder-editor-add, .fh-folder-editor-inline {
            display: flex; align-items: center; gap: 8px;
        }
        .fh-folder-editor-add input, .fh-folder-editor-inline input {
            flex: 1 1 0; min-width: 0; box-sizing: border-box;
            padding: 9px 11px; border-radius: 7px;
            border: 1px solid var(--fh-border); background: var(--fh-bg); color: var(--fh-text);
        }
        .fh-folder-editor button {
            min-height: 40px; padding: 7px 12px; border-radius: 7px;
            border: 1px solid var(--fh-border); background: var(--fh-btn-bg); color: var(--fh-btn-text);
            cursor: pointer; white-space: nowrap;
        }
        .fh-folder-editor button:hover { border-color: var(--fh-accent); }
        .fh-folder-editor button:focus-visible, .persona-folder-settings-btn:focus-visible {
            outline: 2px solid var(--fh-accent); outline-offset: 2px;
        }
        .fh-folder-editor .fh-folder-editor-close {
            min-width: 40px; padding: 0; background: transparent; color: var(--fh-text);
        }
        .fh-folder-editor .fh-folder-editor-primary {
            background: var(--fh-accent); border-color: var(--fh-accent); color: #fff;
        }
        .fh-folder-editor .fh-folder-editor-danger { color: #b93737; }
        .fh-folder-editor-message { min-height: 1.4em; margin: 7px 0 10px; font-size: .85rem; }
        .fh-folder-editor-message.is-error { color: #b93737; }
        .fh-folder-editor-list { display: flex; flex-direction: column; gap: 7px; }
        .fh-folder-editor-row {
            display: flex; align-items: center; justify-content: space-between;
            flex-wrap: wrap; gap: 8px; padding: 9px 10px;
            border: 1px solid var(--fh-border); border-radius: 8px;
            background: var(--fh-hover-bg);
        }
        .fh-folder-editor-label { min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
        .fh-folder-editor-count { margin-left: 6px; opacity: .65; font-size: .8rem; white-space: nowrap; }
        .fh-folder-editor-actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .fh-folder-editor-order { display: flex; gap: 4px; }
        .fh-folder-editor-order button { min-width: 40px; padding-inline: 8px; }
        .fh-folder-editor button:disabled { opacity: .4; cursor: default; }
        .fh-folder-editor-inline { width: 100%; flex-wrap: wrap; }
        .fh-folder-editor-inline-note { flex-basis: 100%; font-size: .84rem; }
        @media (max-width: 768px) {
            .fh-folder-editor { width: min(96vw, 540px); max-height: 90dvh; }
            .fh-folder-editor-main { padding: 14px; }
            .fh-folder-editor button { min-height: 44px; }
            .fh-folder-editor input { font-size: 16px; }
            .fh-folder-editor-row { align-items: stretch; }
            .fh-folder-editor-actions { width: 100%; }
            .fh-folder-editor-actions button { flex: 1; }
        }
        
        
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

        /* Bound both managers to the visible screen, never to #chat's rectangle.
           Keep the header/footer outside the scrolling middle section. */
        .fh-viewport-manager {
            top: var(--fh-viewport-top, 0px); left: var(--fh-viewport-left, 0px);
            width: var(--fh-viewport-width, 100vw);
            height: var(--fh-viewport-height, 100vh);
            height: var(--fh-viewport-height, 100dvh);
            box-sizing: border-box; overflow: hidden;
            padding: max(8px, env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px))
                     max(8px, env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
        }
        .fh-viewport-manager .toc-manager-modal {
            position: relative; inset: auto; transform: none; margin: 0;
            box-sizing: border-box; min-width: 0; min-height: 0;
            width: 90%; height: 100%; max-height: 92%; flex: none;
        }
        .fh-viewport-manager .toc-header, .fh-viewport-manager .toc-footer {
            flex: none; min-width: 0; gap: 8px;
        }
        .fh-viewport-manager .toc-header > span { min-width: 0; overflow-wrap: anywhere; }
        .fh-viewport-manager .fh-manager-close {
            display: flex; align-items: center; justify-content: center; flex: none;
            width: 44px; height: 44px; padding: 0; border: 0; border-radius: 7px;
            background: transparent; color: var(--fh-text); font-size: 1.4rem; cursor: pointer;
        }
        .fh-manager-content {
            display: flex; flex-direction: column; flex: 1 1 auto;
            min-width: 0; min-height: 0; overflow: hidden;
        }
        .fh-selection-actions, .fh-tag-selection { display: contents; }
        .fh-viewport-manager .toc-toolbar { flex: none; min-width: 0; }
        .fh-viewport-manager .toc-toolbar-row { min-width: 0; flex-wrap: wrap; }
        .fh-viewport-manager .toc-toolbar-row > div { min-width: 0; max-width: 100%; flex-wrap: wrap; }
        .fh-viewport-manager .toc-toolbar input, .fh-viewport-manager .toc-toolbar select {
            min-width: 0 !important; max-width: 100%; box-sizing: border-box;
        }
        .fh-viewport-manager .toc-body { flex: 1 1 auto; min-width: 0; min-height: 0; }
        .fh-viewport-manager .toc-footer { flex-wrap: wrap; }
        .fh-viewport-manager .toc-footer button { max-width: 100%; }
        .fh-manager-compact .fh-manager-content { overflow-y: auto; overscroll-behavior: contain; }
        .fh-manager-compact .toc-body { flex: none; overflow-y: visible !important; }
        @media (max-width: 1000px) {
            .fh-viewport-manager .toc-manager-modal { width: 100%; max-height: 100%; }
            .fh-viewport-manager .toc-header, .fh-viewport-manager .toc-toolbar,
            .fh-viewport-manager .toc-body, .fh-viewport-manager .toc-footer { padding: 10px 12px !important; }
            .fh-viewport-manager .toc-toolbar input, .fh-viewport-manager .toc-toolbar select,
            .fh-viewport-manager .toc-body input[type="text"] { font-size: 16px !important; }
            .fh-viewport-manager #pm_search_input { flex: 1 1 100% !important; width: 100%; }
            .fh-viewport-manager #pm_filter_lang, .fh-viewport-manager #pm_filter_folder { flex: 1 1 120px; }
            .fh-viewport-manager .fh-pm-selection-controls, .fh-viewport-manager .fh-pm-move-controls { flex: 1 1 100%; }
            .fh-viewport-manager #pm_target_folder, .fh-viewport-manager #toc_move_target_select { flex: 1 1 140px; }
            .fh-viewport-manager #toc_tag_filter_input { flex: 1 1 150px; }
            .fh-viewport-manager #pm_status { flex: 1 1 160px; }

            /* Touch scrolling stays enabled; ST's wide scrollbar consumes no space. */
            .fh-viewport-manager, .fh-viewport-manager * { scrollbar-width: none !important; }
            .fh-viewport-manager::-webkit-scrollbar,
            .fh-viewport-manager *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }

            .fh-viewport-manager .toc-header, .fh-viewport-manager .toc-footer { padding: 6px 10px !important; }
            .fh-viewport-manager .toc-header > span { font-size: 1rem !important; line-height: 1.3; }
            .fh-viewport-manager .fh-manager-close { width: 36px; height: 36px; font-size: 1.25rem; }
            .fh-viewport-manager .toc-toolbar { padding: 8px 10px !important; gap: 6px !important; }
            .fh-viewport-manager .toc-toolbar-row { gap: 6px !important; }
            .fh-viewport-manager .toc-toolbar button,
            .fh-viewport-manager .toc-footer button {
                min-height: 32px; margin: 0; padding: 4px 8px !important; line-height: 1.25;
                border-radius: 6px !important; font-size: .78rem !important; box-shadow: none;
            }
            .fh-viewport-manager .toc-toolbar input:not([type="checkbox"]),
            .fh-viewport-manager .toc-toolbar select {
                width: 100%; height: 32px; min-height: 32px; margin: 0;
                padding: 4px 8px !important; line-height: 1.25; border-radius: 6px !important;
            }
            .fh-viewport-manager .fh-toolbar-divider { display: none; }
            .fh-viewport-manager .fh-pm-search-controls {
                display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .fh-viewport-manager .fh-pm-search-controls #pm_search_input { grid-column: 1 / -1; }
            .fh-viewport-manager .fh-pm-selection-controls,
            .fh-viewport-manager .fh-toc-selection-controls {
                display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr));
                align-items: center !important; gap: 6px !important;
            }
            .fh-viewport-manager .fh-selection-actions {
                display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px;
                width: fit-content; max-width: 100%;
            }
            .fh-viewport-manager .fh-selection-actions button { padding-inline: 5px !important; font-size: .78rem !important; }
            .fh-viewport-manager .fh-view-switch {
                display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 2px; width: fit-content; max-width: 100%; justify-self: end; margin: 0; padding: 1px;
                border: 1px solid var(--fh-border); border-radius: 7px; background: var(--fh-hover-bg);
            }
            .fh-viewport-manager .fh-view-switch button {
                min-width: 0; min-height: 28px; padding: 4px 6px !important;
                border: 0; border-radius: 5px !important; font-size: .78rem !important;
            }
            .fh-viewport-manager .fh-toc-selection-controls > .fh-view-switch,
            .fh-viewport-manager .fh-pm-selection-controls > .fh-view-switch { grid-column: 2; grid-row: 1; }
            .fh-viewport-manager .fh-tag-selection {
                display: grid; grid-column: 1 / -1;
                grid-template-columns: minmax(0, 1fr) auto; gap: 6px;
            }
            .fh-viewport-manager .fh-tag-selection #toc_tag_filter_input { width: 100% !important; }
            .fh-viewport-manager .fh-image-toggle {
                grid-column: 1 / -1; display: flex !important; align-items: center;
                gap: 5px !important; min-height: 22px; margin: 0; font-size: .78rem !important;
            }
            .fh-viewport-manager .fh-image-toggle input[type="checkbox"] {
                flex: none; width: 20px; height: 20px; min-height: 0;
                padding: 0; margin: 0 2px 0 0;
            }
            .fh-viewport-manager .fh-manager-move-controls {
                display: grid !important; grid-template-columns: auto minmax(0, 1fr) auto;
                align-items: center !important; gap: 6px !important;
            }
            .fh-viewport-manager .fh-manager-move-controls > span { font-size: .72rem !important; }
            .fh-viewport-manager #toc_move_execute_btn, .fh-viewport-manager #pm_execute_move {
                background: var(--fh-accent); color: #fff; border-color: var(--fh-accent);
            }
            .fh-viewport-manager #pm_drop_targets { padding: 8px 12px; gap: 6px; }
            .fh-viewport-manager .pm-drop-target {
                min-height: 40px; padding: 7px 12px; border-radius: 8px; font-size: .82rem;
            }
            .fh-viewport-manager #toc_manager_modal_inner > .toc-footer {
                display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px !important;
            }
            .fh-viewport-manager #toc_manager_modal_inner > .toc-footer button { width: 100% !important; white-space: normal; }
            .fh-viewport-manager .save-toc-btn { background: var(--fh-accent); color: #fff; border-color: var(--fh-accent); }
            .fh-viewport-manager #pm_status { font-size: .74rem !important; }
            .fh-viewport-manager .toc-checkbox-row { padding: 8px 10px !important; gap: 6px !important; }
            .fh-viewport-manager .toc-checkbox-row > div { gap: 8px !important; }
            .fh-viewport-manager .toc-checkbox-row label { font-size: .8rem !important; }
            .fh-viewport-manager #toc_search_input {
                min-height: 32px; padding: 4px 32px 4px 10px !important; line-height: 1.25;
            }
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
        .fh-toc-info-popover {
            position: fixed; z-index: 10003; display: none;
            width: 280px; max-width: calc(100vw - 24px);
            max-height: calc(100dvh - 16px); overflow-y: auto;
            background: var(--fh-bg); color: var(--fh-text);
            border: 1px solid var(--fh-accent); border-radius: 8px;
            box-shadow: 0 5px 18px rgba(0,0,0,.28);
            padding: 12px; box-sizing: border-box;
            font-size: .85rem; line-height: 1.4;
        }

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

        #toc_manager_modal_inner { max-width: 1100px; }
        #toc_items_list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
            align-content: start; gap: 12px;
            overscroll-behavior: contain;
        }
        #toc_items_list .toc-checkbox-row,
        #toc_items_list .toc-item.type-header { grid-column: 1 / -1; }
        #toc_items_list .toc-item {
            display: flex; flex-direction: column; align-items: stretch;
            min-width: 0; margin: 0; padding: 0; overflow: visible;
            border-radius: 10px; cursor: grab; touch-action: pan-y;
            -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
            transition: none;
        }
        #toc_items_list .toc-item-name[contenteditable="true"] {
            -webkit-user-select: text; user-select: text;
        }
        #toc_items_list img {
            -webkit-user-drag: none; -webkit-touch-callout: none;
            -webkit-user-select: none; user-select: none;
        }
        .fh-toc-drag-hint { font-size: .8rem; opacity: .7; }
        .fh-toc-drag-hint .fh-touch-hint { display: none; }
        .fh-view-switch { display: inline-flex; gap: 3px; align-items: center; }
        .fh-view-switch button { opacity: .65; }
        .fh-view-switch button.active {
            opacity: 1; background: var(--fh-accent); color: #fff;
            border-color: var(--fh-accent);
        }
        #toc_items_list .toc-item.type-header {
            flex-direction: row; align-items: center; min-height: 52px;
            padding: 8px 12px;
        }
        #toc_items_list .toc-card-media {
            position: relative; aspect-ratio: 2 / 3; overflow: hidden;
            border-radius: 9px 9px 0 0; background: var(--fh-hover-bg);
        }
        #toc_items_list .toc-card-media img,
        #toc_items_list .toc-card-media .toc-avatar-placeholder {
            display: block; width: 100%; height: 100%; margin: 0;
            border: 0; border-radius: 0; object-fit: cover;
        }
        #toc_items_list .toc-card-media .toc-avatar-placeholder {
            display: flex; font-size: 2rem;
        }
        #toc_items_list .toc-card-media .toc-item-checkbox {
            position: absolute; top: 9px; left: 9px; z-index: 1;
            box-shadow: 0 1px 5px rgba(0,0,0,.45);
        }
        #toc_items_list .toc-card-compact-top {
            display: flex; align-items: center; gap: 8px;
            padding: 9px 10px 0; color: var(--fh-accent);
        }
        #toc_items_list .toc-card-body { min-width: 0; padding: 9px 10px 5px; }
        #toc_items_list .toc-card-body .toc-item-name {
            display: block; margin: 0; font-weight: 600;
        }
        #toc_items_list .toc-card-body .toc-card-type {
            display: block; margin-top: 3px; opacity: .65; font-size: .75rem;
        }
        #toc_items_list .toc-controls {
            justify-content: flex-end; margin: auto 0 0; padding: 5px 7px 8px;
            flex-wrap: wrap;
        }
        #toc_items_list .toc-item.type-header .toc-controls { margin: 0 0 0 auto; padding: 0; }
        #toc_items_list .toc-item.type-header .toc-item-name {
            white-space: normal; cursor: text;
        }
        #toc_items_list .toc-drag-handle {
            display: flex; align-items: center; justify-content: center;
            width: 36px; height: 36px; margin-right: 8px;
            border-radius: 6px; cursor: grab; flex: none;
            color: var(--fh-accent); touch-action: none;
        }
        #toc_items_list .toc-drag-handle:hover { background: var(--fh-hover-bg); }
        #toc_items_list .toc-item.type-header .toc-item-checkbox { margin-right: 8px; }
        #toc_items_list .toc-item.fh-dragging { opacity: .45; }
        #toc_items_list .toc-item.fh-drop-before::before,
        #toc_items_list .toc-item.fh-drop-after::after {
            content: ''; position: absolute; top: 8px; bottom: 8px;
            width: 4px; border-radius: 4px; background: var(--fh-accent);
            z-index: 3; pointer-events: none;
        }
        #toc_items_list .toc-item.fh-drop-before::before { left: -8px; }
        #toc_items_list .toc-item.fh-drop-after::after { right: -8px; }
        #toc_items_list .toc-item.type-header.fh-drop-before::before,
        #toc_items_list .toc-item.type-header.fh-drop-after::after,
        #toc_items_list .toc-item.type-page.fh-drop-before::before,
        #toc_items_list .toc-item.type-page.fh-drop-after::after {
            left: 0; right: 0; width: auto; height: 4px;
        }
        #toc_items_list .toc-item.type-header.fh-drop-before::before,
        #toc_items_list .toc-item.type-page.fh-drop-before::before { top: -8px; bottom: auto; }
        #toc_items_list .toc-item.type-header.fh-drop-after::after,
        #toc_items_list .toc-item.type-page.fh-drop-after::after { bottom: -8px; top: auto; }
        #toc_items_list .toc-item.type-page {
            grid-column: 1 / -1; flex-direction: row; align-items: center;
            min-height: 48px; padding: 7px 12px;
            border-style: dashed; border-color: var(--fh-accent);
            background: var(--fh-hover-bg); color: var(--fh-accent);
        }
        #toc_items_list .toc-item.type-page .toc-item-name {
            font-weight: 700; white-space: normal;
        }
        #toc_items_list.fh-list-view { grid-template-columns: minmax(0, 1fr); gap: 5px; }
        #toc_items_list.fh-list-view .toc-item:not(.type-header):not(.type-page) {
            flex-direction: row; align-items: center; min-height: 70px;
        }
        #toc_items_list.fh-list-view .toc-item.type-page { min-height: 48px; }
        #toc_items_list.fh-list-view .toc-card-media {
            width: 46px; height: 68px; aspect-ratio: auto; flex: none;
            border-radius: 8px 0 0 8px;
        }
        #toc_items_list.fh-list-view .toc-card-media .toc-item-checkbox {
            top: 4px; left: 4px; width: 18px; height: 18px; margin: 0;
        }
        #toc_items_list.fh-list-view .toc-card-compact-top { padding: 0 0 0 10px; }
        #toc_items_list.fh-list-view .toc-card-body { flex: 1; padding: 6px 9px; }
        #toc_items_list.fh-list-view .toc-controls { margin: 0; padding: 5px 8px; flex: none; }
        #toc_items_list.fh-list-view .toc-item.fh-drop-before::before,
        #toc_items_list.fh-list-view .toc-item.fh-drop-after::after {
            left: 8px; right: 8px; width: auto; height: 4px;
        }
        #toc_items_list.fh-list-view .toc-item.fh-drop-before::before { top: -5px; bottom: auto; }
        #toc_items_list.fh-list-view .toc-item.fh-drop-after::after { bottom: -5px; top: auto; }
        .fh-toc-drag-ghost {
            position: fixed; z-index: 10002; pointer-events: none;
            will-change: transform;
            max-width: 180px; padding: 7px 10px; border-radius: 8px;
            background: var(--fh-accent); color: #fff; font-size: .85rem;
            box-shadow: 0 5px 16px rgba(0,0,0,.3);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        @media (max-width: 768px) {
            #toc_items_list { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; }
            #toc_items_list .toc-controls .toc-btn { width: 36px; height: 36px; }
            .fh-toc-drag-hint .fh-mouse-hint { display: none; }
            .fh-toc-drag-hint .fh-touch-hint { display: inline; }
        }

        #persona_bulk_manage_btn {
            cursor: pointer; margin-right: 5px; color: var(--SmartThemeBodyColor); transition: color 0.2s;
        }
        #persona_bulk_manage_btn:hover { color: var(--fh-accent); }
        
        .persona-folder-badge {
            font-size: 0.75rem; background: var(--fh-secondary); color: var(--fh-text);
            padding: 2px 6px; border-radius: 4px; margin-left: 5px;
        }
        #pm_modal_inner { max-width: 1000px; }
        #pm_list_body {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
            align-content: start; gap: 12px; overscroll-behavior: contain;
        }
        #pm_list_body .pm-card {
            display: flex; flex-direction: column; align-items: stretch;
            min-width: 0; margin: 0; padding: 0; border-radius: 10px;
            cursor: grab; touch-action: pan-y;
            -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
            transition: none;
        }
        #pm_list_body .pm-card-media {
            position: relative; aspect-ratio: 2 / 3; overflow: hidden;
            border-radius: 9px 9px 0 0; background: var(--fh-hover-bg);
        }
        #pm_list_body .pm-avatar-img {
            display: block; width: 100%; height: 100%; object-fit: cover;
            margin: 0; border: 0; border-radius: 0; -webkit-user-drag: none;
            -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
        }
        #pm_list_body .pm-card-media .toc-avatar-placeholder {
            width: 100%; height: 100%; margin: 0; border: 0; font-size: 2rem;
        }
        #pm_list_body .pm-card-media .toc-item-checkbox {
            position: absolute; top: 9px; left: 9px; z-index: 1;
            box-shadow: 0 1px 5px rgba(0,0,0,.45);
        }
        #pm_list_body .pm-card-body { min-width: 0; padding: 9px 10px 11px; overflow: hidden; }
        #pm_list_body .pm-card-name {
            display: block; font-weight: 700; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis;
        }
        #pm_list_body .pm-add-info { display: block; overflow: hidden; text-overflow: ellipsis; margin: 5px 0; }
        #pm_list_body .pm-card-body .pm-add-info {
            max-width: 100%; min-width: 0; box-sizing: border-box;
        }
        #pm_list_body .pm-folder-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        #pm_list_body .persona-folder-badge { margin: 0; }
        #pm_list_body .pm-compact-check { display: flex; align-items: center; padding: 10px 10px 0; }
        #pm_list_body.fh-list-view {
            grid-template-columns: minmax(0, 1fr);
            grid-auto-rows: max-content; align-items: start; gap: 5px;
        }
        #pm_list_body.fh-list-view .pm-card {
            display: flex; flex-direction: row; align-items: flex-start;
            box-sizing: border-box; height: max-content; min-height: 70px;
        }
        #pm_list_body.fh-list-view .pm-card-media {
            width: 46px; height: 68px; aspect-ratio: auto; flex: none;
            border-radius: 8px 0 0 8px;
        }
        #pm_list_body.fh-list-view .pm-card-media .toc-item-checkbox {
            top: 4px; left: 4px; width: 18px; height: 18px; margin: 0;
        }
        #pm_list_body.fh-list-view .pm-compact-check { padding: 0 0 0 10px; }
        #pm_list_body.fh-list-view .pm-card-body {
            flex: 1 1 0; min-width: 0; width: auto;
            height: max-content; box-sizing: border-box;
            overflow: visible; padding: 6px 10px 10px;
        }
        #pm_list_body.fh-list-view .pm-folder-badges { margin-top: 3px; }
        #pm_list_body .pm-card.fh-dragging { opacity: .45; }
        #pm_drop_targets {
            display: flex; gap: 6px; overflow-x: auto; padding: 9px 16px;
            border-bottom: 1px solid var(--fh-border); flex: none;
        }
        .pm-drop-target {
            flex: none; border: 1px solid var(--fh-border); border-radius: 7px;
            padding: 7px 10px; background: var(--fh-bg); color: var(--fh-text);
            white-space: nowrap; font-size: .82rem; cursor: pointer;
        }
        .pm-drop-target.fh-drop-active, .pm-drop-target.fh-filter-active {
            border-color: var(--fh-accent); background: var(--fh-accent); color: #fff;
        }
        #pm_status { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pm-name-block { display: flex; align-items: center; flex: 1; flex-wrap: wrap; gap: 8px; }
        .pm-add-info {
            font-size: 0.75rem; color: var(--fh-text); opacity: 0.8;
            background: var(--fh-secondary); padding: 2px 8px;
            border-radius: 6px; border: 1px solid var(--fh-border); white-space: nowrap;
        }

        @media (max-width: 768px) {
            #pm_list_body { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; }
            .pm-drop-target { min-height: 44px; }
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
        #fh_page_controls {
            position: absolute; bottom: 15px; right: 65px; z-index: 200;
            display: none; align-items: center; gap: 3px;
            height: 32px; padding: 0 4px; border-radius: 18px;
            background: var(--fh-bg); color: var(--fh-text);
            border: 1px solid var(--fh-border);
            box-shadow: 0 2px 5px rgba(0,0,0,.2);
        }
        #fh_page_controls.fh-no-jump { right: 25px; }
        #fh_page_controls button {
            border: 0; background: transparent; color: inherit;
            width: 28px; height: 28px; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
        }
        #fh_page_controls button:hover:not(:disabled) { background: var(--fh-hover-bg); color: var(--fh-accent); }
        #fh_page_controls button:disabled { opacity: .3; cursor: default; }
        #fh_page_label { font-size: .75rem; min-width: 30px; text-align: center; white-space: nowrap; }
        @media (max-width: 768px) {
            #fh_jump_btn {
                width: 44px; height: 44px;
                bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                right: calc(12px + env(safe-area-inset-right, 0px));
            }
            #fh_jump_menu {
                bottom: calc(64px + env(safe-area-inset-bottom, 0px));
                right: calc(12px + env(safe-area-inset-right, 0px));
                max-width: calc(100vw - 24px);
                max-height: 60dvh;
                box-sizing: border-box;
            }
            .fh-jump-item { min-height: 44px; box-sizing: border-box; }
            #fh_page_controls {
                bottom: calc(12px + env(safe-area-inset-bottom, 0px));
                right: calc(64px + env(safe-area-inset-right, 0px));
                height: 44px;
            }
            #fh_page_controls.fh-no-jump { right: calc(12px + env(safe-area-inset-right, 0px)); }
            #fh_page_controls button { width: 36px; height: 36px; }
        }
        #rm_print_characters_block > .fh-jump-spacer {
            flex: none;
            pointer-events: none;
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
        .char-list-page-break {
            width: 100%; box-sizing: border-box; flex: none;
            margin: 8px 0 12px; padding: 5px 9px;
            border-bottom: 1px solid var(--fh-border);
            color: var(--fh-text); opacity: .65;
            font-size: .78rem; text-align: center;
        }
    `;
    
    const $style = $(`<style id="${STYLE_ID}">`).text(staticCss);
    $('head').append($style);
}


// =========================================================================
// 2. Logic: 컨텍스트 식별 및 DOM 획득
// =========================================================================

function getCurrentContextId() {
    return getCurrentContextInfo().id;
}

function getCurrentContextInfo() {
    if (!entitiesFilter || !tags) return { id: 'root', legacyId: 'root', name: 'Main List' };

    const filterData = entitiesFilter.getFilterData('tag');
    const selectedTags = filterData ? Array.from(filterData.selected || []) : [];
    const tagById = new Map(tags.map(tag => [String(tag.id), tag]));

    const folderTags = selectedTags
        .map(tagId => tagById.get(String(tagId)))
        .filter(isBogusFolder);

    const activeFolderTag = folderTags[folderTags.length - 1];

    if (activeFolderTag) {
        const legacyId = 'folder_' + activeFolderTag.id;
        const folderPathIds = folderTags.map(tag => tag.id);
        return {
            id: folderPathIds.length > 1 ? 'folder_path_' + folderPathIds.join('__') : legacyId,
            legacyId,
            name: folderTags.map(tag => tag.name).join(' / '),
        };
    }

    return { id: 'root', legacyId: 'root', name: 'Main List' };
}

function countTocMatches(currentItems, tocItems) {
    const realTocItems = (tocItems || []).filter(i => i.type !== 'header' && i.type !== 'page');
    if (currentItems.length === 0 || realTocItems.length === 0) return 0;

    const domKeySet = new Set(currentItems.map(i => `${i.type}_${i.id}`));
    let matchCount = realTocItems.filter(i => domKeySet.has(`${i.type}_${i.id}`)).length;

    if (matchCount === 0) {
        const domNameSet = new Set(currentItems.map(i => i.name));
        matchCount += realTocItems.filter(i => domNameSet.has(i.id)).length;
    }

    return matchCount;
}

function getTocConfigForContext(contextInfo, currentItems) {
    const directConfig = settings.toc[contextInfo.id];
    if (directConfig) {
        return { config: directConfig, key: contextInfo.id, isLegacy: false };
    }

    if (contextInfo.legacyId && contextInfo.legacyId !== contextInfo.id) {
        const legacyConfig = settings.toc[contextInfo.legacyId];
        if (legacyConfig && countTocMatches(currentItems, legacyConfig.items) > 0) {
            return { config: legacyConfig, key: contextInfo.legacyId, isLegacy: true };
        }
    }

    return { config: null, key: contextInfo.id, isLegacy: false };
}

function getDomItems($container, includeDetails = false) {
    const items = [];
    $container.children().each(function() {
        const $el = $(this);
        if ($el.hasClass('char-list-separator') || $el.hasClass('char-list-page-break')) return; 
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
            
            if (includeDetails) description = $el.find('.ch_description').text().trim();

            if (characters[chid] && characters[chid].avatar) {
                id = characters[chid].avatar; 
            } else {
                id = name;
            }

            if (includeDetails) $el.find('.tags .tag_name').each(function() {
                tags.push($(this).text().trim());
            });
        } else if ($el.hasClass('bogus_folder_select')) {
            type = 'folder';
            id = $el.attr('tagid'); 
            name = $el.find('.ch_name').text().trim();
            if (includeDetails) $el.find('.tags .tag_name').each(function() {
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
            if (!settings.enabled || !settings.hiddenFolders.length || document.getElementById('BogusFolderBack')) return;
            const hiddenTitles = new Set(settings.hiddenFolders.map(name => `[Folder] ${name}`));
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1 || !node.classList.contains('bogus_folder_select')) continue;
                    const title = node.querySelector('span.ch_name')?.getAttribute('title');
                    if (hiddenTitles.has(title)) node.classList.add(HIDDEN_CLASS);
                }
            }
        });
        mainListObserver.observe(target, { childList: true, subtree: false });
    }
}

function scheduleCharacterListUpdate() {
    if (observerRaf) cancelAnimationFrame(observerRaf);
    observerRaf = requestAnimationFrame(() => {
        observerRaf = null;
        hideFoldersOnListUpdate();
    });
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
const currentPageByContext = new Map();

function showTocPage(contextId, requestedPage, resetScroll = true) {
    const $container = $('#rm_print_characters_block');
    if (!$container.length) return;
    const breakCount = $container.children('.char-list-page-break').length;
    const pageCount = breakCount + 1;
    const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
    currentPageByContext.set(contextId, page);

    let itemPage = 0;
    $container.children().each(function() {
        if (this.classList.contains('char-list-page-break')) itemPage++;
        if (!this.matches('.char-list-page-break, .char-list-separator, .character_select, .bogus_folder_select') ||
            this.id === 'BogusFolderBack') return;
        this.classList.toggle(PAGE_HIDDEN_CLASS, breakCount > 0 && itemPage !== page);
        if (this.classList.contains('char-list-separator')) this.dataset.fhPage = String(itemPage);
    });

    if (resetScroll) {
        cancelActiveJump?.();
        $container.children('.fh-jump-spacer').remove();
        $container[0].scrollTop = 0;
    }
    const $controls = $('#fh_page_controls');
    $controls.css('display', pageCount > 1 ? 'flex' : 'none');
    $('#fh_page_prev').prop('disabled', page === 0);
    $('#fh_page_next').prop('disabled', page === pageCount - 1);
    $('#fh_page_label').text(`${page + 1}/${pageCount}`);
}

function injectJumpButton() {
    const $parent = $('#rm_characters_block');
    if ($parent.find('#fh_jump_btn').length === 0) {
        $parent.append(`
            <div id="fh_page_controls" aria-label="목록 페이지 이동">
                <button type="button" id="fh_page_prev" title="이전 페이지" aria-label="이전 페이지"><i class="fa-solid fa-chevron-left"></i></button>
                <span id="fh_page_label"></span>
                <button type="button" id="fh_page_next" title="다음 페이지" aria-label="다음 페이지"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div id="fh_jump_btn" title="구분선으로 이동">
                <i class="fa-solid fa-list-ul"></i>
            </div>
            <div id="fh_jump_menu"></div>
        `);

        $('#fh_page_prev, #fh_page_next').on('click', function(event) {
            event.stopPropagation();
            $('#fh_jump_menu').hide();
            $('#fh_jump_btn').removeClass('active');
            const contextId = getCurrentContextInfo().id;
            const page = currentPageByContext.get(contextId) || 0;
            showTocPage(contextId, page + (this.id === 'fh_page_next' ? 1 : -1));
        });

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

let cancelActiveJump = null;

function jumpToSeparator(container, separator) {
    cancelActiveJump?.();
    container.querySelector(':scope > .fh-jump-spacer')?.remove();
    if (!container.contains(separator) || !container.clientHeight) return;

    const previousScrollBehavior = container.style.scrollBehavior;
    const previousOverflowAnchor = container.style.overflowAnchor;
    container.style.scrollBehavior = 'auto';
    container.style.overflowAnchor = 'none';

    let spacer = null;
    let frame = 0;
    let stableFrames = 0;
    let rafId = null;
    const finish = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        container.removeEventListener('wheel', finish);
        container.removeEventListener('touchstart', finish);
        container.removeEventListener('pointerdown', finish);
        container.style.scrollBehavior = previousScrollBehavior;
        container.style.overflowAnchor = previousOverflowAnchor;
        if (cancelActiveJump === finish) cancelActiveJump = null;
    };
    cancelActiveJump = finish;
    container.addEventListener('wheel', finish, { passive: true });
    container.addEventListener('touchstart', finish, { passive: true });
    container.addEventListener('pointerdown', finish, { passive: true });

    const align = () => {
        if (!container.contains(separator)) {
            spacer?.remove();
            finish();
            return;
        }
        const delta = separator.getBoundingClientRect().top -
            container.getBoundingClientRect().top - container.clientTop - 8;
        const desiredTop = container.scrollTop + delta;
        const maxTop = container.scrollHeight - container.clientHeight;
        if (desiredTop > maxTop) {
            if (!spacer) {
                spacer = document.createElement('div');
                spacer.className = 'fh-jump-spacer';
                spacer.setAttribute('aria-hidden', 'true');
                container.append(spacer);
            }
            spacer.style.height = `${(parseFloat(spacer.style.height) || 0) + Math.ceil(desiredTop - maxTop) + 2}px`;
        }
        if (Math.abs(delta) > 2) container.scrollTop = desiredTop;

        const remaining = separator.getBoundingClientRect().top -
            container.getBoundingClientRect().top - container.clientTop - 8;
        stableFrames = Math.abs(remaining) <= 2 ? stableFrames + 1 : 0;
        frame++;
        if (frame >= 24 || (frame >= 8 && stableFrames >= 6)) finish();
        else rafId = requestAnimationFrame(align);
    };
    align();
}

function updateJumpMenu() {
    const $menu = $('#fh_jump_menu');
    $menu.empty();

    const $container = $('#rm_print_characters_block');
    const separators = $container.find('.char-list-separator');

    if (separators.length === 0) {
        cancelActiveJump?.();
        $container.children('.fh-jump-spacer').remove();
        $('#fh_jump_btn').hide(); 
        $('#fh_page_controls').addClass('fh-no-jump');
        $menu.hide();
        return;
    } else {
        $('#fh_jump_btn').css('display', 'flex'); 
        $('#fh_page_controls').removeClass('fh-no-jump');
    }

    separators.each(function(index) {
        const $sep = $(this);
        const text = $sep.find('span').text();
        
        const $item = $(`<div class="fh-jump-item"><i class="fa-solid fa-chevron-right"></i> ${escapeHtml(text)}</div>`);
        
        $item.click(function() {
            const contextId = getCurrentContextInfo().id;
            const targetPage = Number($sep.attr('data-fh-page')) || 0;
            if ((currentPageByContext.get(contextId) || 0) !== targetPage) {
                showTocPage(contextId, targetPage);
                requestAnimationFrame(() => {
                    if (currentPageByContext.get(contextId) === targetPage) jumpToSeparator($container[0], $sep[0]);
                });
            } else {
                jumpToSeparator($container[0], $sep[0]);
            }
            
            $menu.fadeOut(100);
            $('#fh_jump_btn').removeClass('active');
        });

        $menu.append($item);
    });

    $menu.append('<div style="border-top:1px solid #ddd; margin: 4px 0;"></div>');
    const $topItem = $(`<div class="fh-jump-item" style="color:#666;"><i class="fa-solid fa-arrow-up"></i> 맨 위로</div>`);
    $topItem.click(function(){
         cancelActiveJump?.();
         $container.children('.fh-jump-spacer').remove();
         const contextId = getCurrentContextInfo().id;
         if ($container.children('.char-list-page-break').length) showTocPage(contextId, 0);
         $container[0].scrollTop = 0;
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
    tocButton.on('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            $(this).trigger('click');
        }
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

    const contextInfo = getCurrentContextInfo();
    const contextId = contextInfo.id;
    const hasPossibleConfig = Boolean(settings.toc[contextId]) ||
        (contextInfo.legacyId !== contextId && Boolean(settings.toc[contextInfo.legacyId]));
    if (!hasPossibleConfig && !$container.children('.char-list-separator, .char-list-page-break, .' + COLLAPSED_CLASS + ', .' + PAGE_HIDDEN_CLASS).length) {
        showTocPage(contextId, 0, false);
        if (document.getElementById('fh_jump_btn')?.style.display === 'flex') updateJumpMenu();
        return;
    }

    disconnectObserver();
    
    const isVisuallyInFolder = $container.find('#BogusFolderBack').length > 0;

    if (contextId === 'root' && isVisuallyInFolder) {
        $container.children('.char-list-page-break').remove();
        $container.children().removeClass(PAGE_HIDDEN_CLASS);
        $('#fh_page_controls').hide();
        connectObserver();
        updateJumpMenu();
        return;
    }

    const currentItems = getDomItems($container);
    const tocConfig = getTocConfigForContext(contextInfo, currentItems).config;

    if (!tocConfig || !tocConfig.items || tocConfig.items.length === 0) {
        $container.children('.char-list-separator, .char-list-page-break').remove();
        $container.children().removeClass(`${COLLAPSED_CLASS} ${PAGE_HIDDEN_CLASS}`);
        showTocPage(contextId, 0, false);
        connectObserver();
        updateJumpMenu(); 
        return;
    }

    if (tocConfig.items.some(i => i.type !== 'header' && i.type !== 'page') && countTocMatches(currentItems, tocConfig.items) === 0) {
        $container.children('.char-list-page-break').remove();
        $container.children().removeClass(PAGE_HIDDEN_CLASS);
        $('#fh_page_controls').hide();
        connectObserver();
        updateJumpMenu();
        return;
    }
    // -------------------------------------------------------------------------

    // 2. 뒤로가기 버튼 처리 (최상단 보장)
    const $backBtn = $container.find('#BogusFolderBack');
    if ($backBtn.length && $container.children().first()[0] !== $backBtn[0]) {
        $container.prepend($backBtn);
    }

    const previousSeparators = $container.children('.char-list-separator').toArray();
    const previousPageBreaks = $container.children('.char-list-page-break').toArray();
    let separatorIndex = 0;
    let pageBreakIndex = 0;
    let pageNumber = 1;
    const pageCount = 1 + tocConfig.items.filter(item => item.type === 'page').length;

    // 3. 맵핑 준비 (파일명 기준)
    const itemMap = new Map(); 
    currentItems.forEach(item => {
        const key = `${item.type}_${item.id}`;
        itemMap.set(key, item);
    });
    const desiredNodes = [];
    const placedItems = new Set();
    const appendItem = (item) => {
        if (!item || placedItems.has(item)) return;
        placedItems.add(item);
        desiredNodes.push(item.$el[0]);
    };

    const excludeFolders = tocConfig.excludeFolders;
    
    // (A) 폴더 제외 모드일 경우 폴더 먼저 배치
    if (excludeFolders) {
        currentItems.forEach(item => {
            if (item.type === 'folder') {
                const key = `folder_${item.id}`;
                const itemObj = itemMap.get(key);
                if (itemObj) {
                    appendItem(itemObj);
                }
            }
        });
    }

    // (B) 저장된 목차(ToC) 순서대로 배치
    tocConfig.items.forEach(confItem => {
        if (confItem.type === 'page') {
            pageNumber++;
            const previous = previousPageBreaks[pageBreakIndex++];
            const node = previous || document.createElement('div');
            node.className = 'char-list-page-break';
            node.textContent = `페이지 ${pageNumber} / ${pageCount}`;
            desiredNodes.push(node);
        } else if (confItem.type === 'header') {
            const collapseKey = `${contextId}__${confItem.text}`;
            const isCollapsed = settings.collapsed_sections && settings.collapsed_sections[collapseKey];
            const previous = previousSeparators[separatorIndex++];
            const reusable = previous?.getAttribute('data-collapse-key') === collapseKey;
            const $sep = reusable ? $(previous) : $(`
                <div class="char-list-separator${isCollapsed ? ' fh-collapsed' : ''}" data-collapse-key="${escapeHtml(collapseKey)}">
                    <span>${escapeHtml(confItem.text)}<i class="fa-solid fa-chevron-down fh-collapse-icon"></i></span>
                </div>
            `);
            $sep.toggleClass('fh-collapsed', Boolean(isCollapsed));
            if (!reusable) $sep.on('click', function() {
                const key = $(this).data('collapse-key');
                const nowCollapsed = $(this).hasClass('fh-collapsed');
                if (nowCollapsed) {
                    $(this).removeClass('fh-collapsed');
                    if (settings.collapsed_sections) delete settings.collapsed_sections[key];
                    let $next = $(this).next();
                    while ($next.length && !$next.hasClass('char-list-separator') && !$next.hasClass('char-list-page-break')) {
                        $next.removeClass(COLLAPSED_CLASS);
                        $next = $next.next();
                    }
                } else {
                    $(this).addClass('fh-collapsed');
                    if (!settings.collapsed_sections) settings.collapsed_sections = {};
                    settings.collapsed_sections[key] = true;
                    let $next = $(this).next();
                    while ($next.length && !$next.hasClass('char-list-separator') && !$next.hasClass('char-list-page-break')) {
                        $next.addClass(COLLAPSED_CLASS);
                        $next = $next.next();
                    }
                }
                saveSettingsDebounced();
            });
            desiredNodes.push($sep[0]);
        } else {
            if (confItem.type === 'folder' && excludeFolders) return; 

            let key = `${confItem.type}_${confItem.id}`;
            let item = itemMap.get(key);

            if (!item) {
                item = currentItems.find(i => 
                    i.name === confItem.id &&
                    i.type === confItem.type && 
                    !placedItems.has(i)
                );
            }

            appendItem(item);
        }
    });

    // (C) 유동성 대응 
    currentItems.forEach(item => {
        appendItem(item);
    });

    // Avoid moving the whole character list when its order is already correct.
    const existingNodes = $container.children('.character_select, .bogus_folder_select, .char-list-separator, .char-list-page-break')
        .not('#BogusFolderBack').toArray();
    const orderChanged = desiredNodes.length !== existingNodes.length ||
        desiredNodes.some((node, index) => node !== existingNodes[index]);
    if (orderChanged) {
        previousSeparators.filter(node => !desiredNodes.includes(node)).forEach(node => node.remove());
        previousPageBreaks.filter(node => !desiredNodes.includes(node)).forEach(node => node.remove());
        const positions = new Map(existingNodes.map((node, index) => [node, index]));
        const stable = getStableIndices(desiredNodes.map(node => positions.get(node) ?? -1));
        let anchor = $container.children('.hidden_block').first()[0] || null;
        for (let index = desiredNodes.length - 1; index >= 0; index--) {
            const node = desiredNodes[index];
            if (!stable.has(index)) $container[0].insertBefore(node, anchor);
            anchor = node;
        }
    }

    // (D) 히든 카운터 블록 처리
    const $hiddenBlock = $container.find('.hidden_block');
    if ($hiddenBlock.length && $container.children().last()[0] !== $hiddenBlock[0]) {
        $container.append($hiddenBlock);
    }

    $container.children('.' + COLLAPSED_CLASS).removeClass(COLLAPSED_CLASS);
    if (settings.collapsed_sections) {
        $container.find('.char-list-separator.fh-collapsed').each(function() {
            let $next = $(this).next();
            while ($next.length && !$next.hasClass('char-list-separator') && !$next.hasClass('char-list-page-break')) {
                $next.addClass(COLLAPSED_CLASS);
                $next = $next.next();
            }
        });
    }

    connectObserver();
    showTocPage(contextId, currentPageByContext.get(contextId) || 0, false);
    updateJumpMenu();
}


function hideFoldersOnListUpdate() {
    const $characterBlock = $('#rm_print_characters_block');
    if (!$characterBlock.length) return;
    
    if (settings.enabled) {
        applyTocOrderToDom($characterBlock);
    } else {
        disconnectObserver();
        $characterBlock.children('.char-list-separator, .char-list-page-break').remove();
        $characterBlock.children().removeClass(`${COLLAPSED_CLASS} ${PAGE_HIDDEN_CLASS}`);
        showTocPage(getCurrentContextInfo().id, 0, false);
        connectObserver();
        updateJumpMenu();
    }

    const canHide = settings.enabled && settings.hiddenFolders.length > 0 &&
        !$characterBlock.find('#BogusFolderBack').length;
    const hiddenTitles = canHide ? new Set(settings.hiddenFolders.map(name => `[Folder] ${name}`)) : null;
    for (const folder of $characterBlock[0].querySelectorAll('.bogus_folder_select')) {
        const title = folder.querySelector('span.ch_name')?.getAttribute('title');
        const shouldHide = Boolean(hiddenTitles?.has(title));
        if (folder.classList.contains(HIDDEN_CLASS) !== shouldHide) {
            folder.classList.toggle(HIDDEN_CLASS, shouldHide);
        }
    }
}

// =========================================================================
// 4. UI: 목차 관리 팝업 & 백업
// =========================================================================

function renderTocManagerPopup() {
    if ($('#toc_manager_popup').length) return;
    const contextInfo = getCurrentContextInfo();
    const contextId = contextInfo.id;
    const contextTagName = contextId === 'root' ? '메인 목록 (Root)' : contextInfo.name;

    const $container = $('#rm_print_characters_block');
    const currentItems = getDomItems($container, true);
    const contextLookup = getTocConfigForContext(contextInfo, currentItems);
    const savedConfig = contextLookup.config || { excludeFolders: true, items: [] };

    let workingConfigItems = savedConfig.items || [];
    let isConfigMismatch = false;

    if (workingConfigItems.some(i => i.type !== 'header' && i.type !== 'page') && countTocMatches(currentItems, workingConfigItems) === 0) {
        console.warn(`[FolderHider] Context mismatch detected in Popup.`);
        workingConfigItems = []; 
        isConfigMismatch = true;
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
            if (confItem.type === 'page') {
                workingList.push({ type: 'page', id: `page_${Date.now()}_${Math.random()}` });
            } else if (confItem.type === 'header') {
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

    const tagOptionsHtml = sortedTags.map(tag => `<option value="${escapeHtml(tag)}">`).join('');
    
    const displayTitle = isConfigMismatch 
        ? `${contextTagName} (주의: 상위 설정 분리됨)` 
        : `${contextTagName} - 목차 관리`;
const popupHtml = `
        <div class="toc-manager-overlay" id="toc_manager_popup">
			<div class="toc-manager-modal" id="toc_manager_modal_inner">
				<div class="toc-header" style="display:flex; align-items:center; justify-content:space-between; padding: 18px 24px; border-bottom: 1px solid var(--fh-border);">
                    <span style="font-size:1.1rem; font-weight:700; letter-spacing:-0.3px;">${escapeHtml(displayTitle)}</span>
                    <button type="button" class="fh-manager-close close-toc-btn" aria-label="캐릭터 관리 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
                <div class="fh-manager-content">
<div class="toc-toolbar" style="padding: 16px 24px; border-bottom: 1px solid var(--fh-border); display:flex; flex-direction:column; gap:10px;">
                    <div class="toc-toolbar-row fh-toc-selection-controls" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <div class="fh-selection-actions">
                        <button id="toc_select_all_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">전체 선택</button>
                        <button id="toc_deselect_all_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">선택 해제</button>
                        </div>
                        <div class="fh-toolbar-divider" style="width:1px; height:20px; background:var(--fh-border); margin:0 2px;"></div>
                        <div class="fh-tag-selection">
                        <input type="text" id="toc_tag_filter_input" list="toc_tag_datalist" placeholder="태그 선택 또는 검색..." style="width:150px; padding: 7px 12px; border-radius:8px; font-size:0.9rem;">
                        <datalist id="toc_tag_datalist">${tagOptionsHtml}</datalist>
                        <button id="toc_select_by_tag_btn" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">태그로 선택</button>
                        </div>
                        <div class="fh-view-switch" role="group" aria-label="목록 보기 방식">
                            <button type="button" class="fh-toc-view-btn" data-view="card">▦ 카드</button>
                            <button type="button" class="fh-toc-view-btn" data-view="list">☰ 리스트</button>
                        </div>
                    </div>
                    <div class="toc-toolbar-row fh-manager-move-controls" style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.9rem; opacity:0.7; white-space:nowrap;">선택한 항목을:</span>
                        <select id="toc_move_target_select" style="flex:1; min-width:150px; padding: 7px 10px; border-radius:8px; font-size:0.9rem;">
                            <option value="">(이동할 구분선 선택)</option>
                        </select>
                        <button id="toc_move_execute_btn" style="padding: 7px 18px; border-radius:8px; font-size:0.9rem; font-weight:600; white-space:nowrap;">▼ 여기로 이동</button>
                    </div>
                </div>

                <div class="toc-body" id="toc_items_list" style="padding: 16px 24px; overflow-y:auto;">
                    <div class="toc-checkbox-row" style="margin-bottom:12px; padding: 10px 14px; border-radius:8px; background:var(--fh-hover-bg); border:1px solid var(--fh-border); display:flex; flex-direction:column; gap:8px;">
                        <div class="fh-toc-drag-hint"><span class="fh-mouse-hint">카드를 끌어서 순서를 바꿀 수 있습니다.</span><span class="fh-touch-hint">카드를 길게 누른 뒤 끌어서 이동하세요. 평소에는 위아래로 스크롤할 수 있습니다.</span></div>
                        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9rem; font-weight:600;">
                                <input type="checkbox" id="toc_exclude_folders" ${savedConfig.excludeFolders ? 'checked' : ''}>
                                폴더 제외하기 (폴더는 항상 맨 위에 고정, 정렬 제외)
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9rem; font-weight:600;">
                                <input type="checkbox" id="toc_toggle_images" checked>
                                🖼️ 이미지 표시
                            </label>
                        </div>
                        <div style="position:relative; width:100%;">
                            <input type="text" id="toc_search_input" placeholder="🔍 이름 검색..." style="width:100%; padding: 6px 32px 6px 12px; border-radius:7px; font-size:0.88rem; border:1px solid var(--fh-border); background:var(--fh-bg); color:var(--fh-text); box-sizing:border-box;">
                            <i class="fa-solid fa-xmark" id="toc_search_clear" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; opacity:0.4; font-size:0.85rem; display:none; color:var(--fh-text);"></i>
                        </div>
                    </div>
                </div>
                </div>
                <div class="toc-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:8px; padding: 14px 24px; border-top: 1px solid var(--fh-border);">
                    <button class="lavender-btn reset-toc-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem; background: #ff7675 !important; color: #fff !important; margin-right: auto;">↻ 데이터 삭제(초기화)</button>
                    <button class="lavender-btn add-sep-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem;">+ 구분선 추가</button>
                    <button class="lavender-btn add-page-btn" style="width: auto; padding: 7px 16px; font-size:0.9rem;" title="선택한 항목 뒤에서 다음 페이지 시작">+ 페이지 나눔</button>
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
    const $infoPopover = $('<div class="fh-toc-info-popover" role="tooltip"></div>').appendTo($overlay);
    let infoHideTimer = null;

    function hideInfo() {
        clearTimeout(infoHideTimer);
        $infoPopover.hide().empty();
    }

    function showInfo(button) {
        const source = button.querySelector('.toc-tooltip');
        if (!source) return;
        clearTimeout(infoHideTimer);
        $infoPopover.html(source.innerHTML).css('max-height', 'calc(100dvh - 16px)').show();
        const buttonRect = button.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const above = buttonRect.top - 16;
        const below = viewportHeight - buttonRect.bottom - 16;
        const placeAbove = above >= Math.min($infoPopover.outerHeight(), 140) || above > below;
        $infoPopover.css('max-height', `${Math.max(80, Math.min(320, placeAbove ? above : below))}px`);
        const width = $infoPopover.outerWidth();
        const height = $infoPopover.outerHeight();
        const left = Math.max(8, Math.min(buttonRect.right - width, viewportWidth - width - 8));
        const top = placeAbove ? Math.max(8, buttonRect.top - height - 8)
            : Math.min(viewportHeight - height - 8, buttonRect.bottom + 8);
        $infoPopover.css({ left: `${left}px`, top: `${top}px` });
    }

    $list.on('mouseenter', '.toc-btn.info', function() { showInfo(this); });
    $list.on('mouseleave', '.toc-btn.info', function() {
        infoHideTimer = setTimeout(hideInfo, 180);
    });
    $list.on('focusin', '.toc-btn.info', function() { showInfo(this); });
    $list.on('focusout', '.toc-btn.info', function() {
        infoHideTimer = setTimeout(hideInfo, 180);
    });
    $list.on('click', '.toc-btn.info', function(event) {
        event.stopPropagation();
        showInfo(this);
    });
    $list.on('keydown', '.toc-btn.info', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showInfo(this);
        }
    });
    $infoPopover.on('mouseenter', () => clearTimeout(infoHideTimer));
    $infoPopover.on('mouseleave', hideInfo);
    $list.on('scroll', hideInfo);
    $modal.find('.fh-manager-content').on('scroll', hideInfo);
    $(window).on('resize.fhTocInfo', hideInfo);
    $(document).on('pointerdown.fhTocInfo', event => {
        if (!event.target.closest('.toc-btn.info, .fh-toc-info-popover')) hideInfo();
    });

    const unbindViewport = bindManagerViewport($overlay[0]);

    function closePopup() {
        unbindViewport();
        $(window).off('resize.fhTocInfo');
        $(document).off('pointerdown.fhTocInfo');
        hideInfo();
        $infoPopover.remove();
        removeCardDragListeners();
        $('#toc_manager_popup').remove();
    }

    let dragState = null;
    let suppressCardClick = false;
    let lastTouchTime = 0;
    const avatarToChid = new Map();
    $('#rm_print_characters_block .character_select').each(function() {
        const chid = $(this).attr('data-chid');
        const charObj = characters[chid];
        if (charObj?.avatar) avatarToChid.set(charObj.avatar, chid);
    });

    function renderList() {
        hideInfo();
        if (dragState) clearCardDrag();
        $list.toggleClass('fh-list-view', settings.toc_view_mode === 'list');
        const scrollElement = getManagerScrollElement($list[0]);
        const scrollTop = scrollElement.scrollTop;
        $list.find('.toc-item').remove();
        $targetSelect.find('option:not(:first)').remove(); 

        const excludeFolders = $('#toc_exclude_folders').is(':checked');
        const hiddenFolders = settings.hiddenFolders || [];
        const showImages = $('#toc_toggle_images').is(':checked');
        const searchQuery = ($('#toc_search_input').val() || '').toLowerCase().trim();
        const htmlParts = [];

        workingList.forEach((item, index) => {
            if (excludeFolders && item.type === 'folder') return;
            if (searchQuery && !['header', 'page'].includes(item.type) && !item.name.toLowerCase().includes(searchQuery)) return;

            if (item.type === 'header') {
                $targetSelect.append(`<option value="${index}">[구분선] ${escapeHtml(item.text)}</option>`);
            }

            let isHidden = false;
            if (item.type === 'folder' && hiddenFolders.includes(item.name)) {
                isHidden = true;
            }

            const isHeader = item.type === 'header';
            const isPage = item.type === 'page';
            const isMarker = isHeader || isPage;
            const name = isHeader ? `[구분선] ${item.text}` : isPage ? '다음 페이지 시작' : item.name;
            const iconClass = isHeader ? 'fa-heading' : isPage ? 'fa-file-lines' : (item.type === 'folder' ? 'fa-folder' : 'fa-user');
            const isChecked = item._selected ? 'checked' : '';
            const selectedClass = item._selected ? 'selected' : '';
            const hiddenClass = isHidden ? 'is-hidden' : '';
            
            let infoBtnHtml = '';
            if (!isMarker) {
                const tagsHtml = (item.tags && item.tags.length > 0) 
                    ? item.tags.map(t => `<span class="toc-tag-pill">${escapeHtml(t)}</span>`).join('') 
                    : '';
                const descHtml = (item.description) ? `<div class="toc-desc-text">${escapeHtml(item.description)}</div>` : '';
                
                if (tagsHtml || descHtml) {
                    infoBtnHtml = `
                        <div class="toc-btn info" role="button" tabindex="0" aria-label="${escapeHtml(item.name)} 정보">
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
            if (!isMarker && showImages) {
				const chid = avatarToChid.get(item.id);
				const imgSrc = (chid !== undefined && characters[chid] && characters[chid].avatar)
					? getThumbnailUrl('avatar', characters[chid].avatar)
					: null;
                avatarHtml = imgSrc
                    ? `<img src="${escapeHtml(imgSrc)}" class="toc-char-avatar" alt="" loading="lazy" decoding="async" draggable="false">`
                    : `<div class="toc-avatar-placeholder"><i class="fa-solid ${iconClass}"></i></div>`;
            }

            const html = `
                <div class="toc-item type-${item.type} ${hiddenClass} ${selectedClass}"
                     data-index="${index}">
                    ${isMarker ? `<span class="toc-drag-handle" title="${isHeader ? '구분선' : '페이지 경계'} 이동"><i class="fa-solid fa-grip-vertical"></i></span>
                        ${isHeader ? `<input type="checkbox" class="toc-item-checkbox" ${isChecked}>` : `<i class="fa-solid ${iconClass}" style="margin-right:8px;"></i>`}
                        <span class="toc-item-name" ${isHeader ? 'contenteditable="true"' : ''}>${escapeHtml(name)}</span>` : `
                        ${showImages ? `<div class="toc-card-media">
                            ${avatarHtml}
                            <input type="checkbox" class="toc-item-checkbox" ${isChecked}>
                        </div>` : `<div class="toc-card-compact-top">
                            <input type="checkbox" class="toc-item-checkbox" ${isChecked}>
                            <i class="fa-solid ${iconClass}"></i>
                        </div>`}
                        <div class="toc-card-body">
                            <span class="toc-item-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                            <span class="toc-card-type">${item.type === 'folder' ? '폴더' : '캐릭터'}</span>
                        </div>`}
                    <div class="toc-controls">
                        ${infoBtnHtml}
                        <div class="toc-btn up"><i class="fa-solid fa-arrow-up"></i></div>
                        <div class="toc-btn down"><i class="fa-solid fa-arrow-down"></i></div>
                        ${isHeader ? `<div class="toc-btn sort-section" title="이 섹션 이름순 정렬"><i class="fa-solid fa-arrow-down-a-z"></i></div>` : ''}
                        ${isMarker ? `<div class="toc-btn del" title="${isHeader ? '구분선' : '페이지 나눔'} 삭제"><i class="fa-solid fa-trash"></i></div>` : ''}
                    </div>
                </div>
            `;
            htmlParts.push(html);
        });

        if (htmlParts.length) $list.append(htmlParts.join(''));

        scrollElement.scrollTop = scrollTop;
        bindItemEvents();
    }

    function bindItemEvents() {
        $list.find('.toc-item').off('click').on('click', function(e) {
            if ($(e.target).closest('input, button, .toc-btn, .toc-drag-handle, [contenteditable="true"]').length) return;
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
            const index = $(this).closest('.toc-item').data('index');
            if (confirm(`이 ${workingList[index].type === 'page' ? '페이지 나눔' : '구분선'}을 삭제하시겠습니까?`)) {
                workingList.splice(index, 1);
                renderList();
            }
        });

        $list.find('.toc-btn.sort-section').click(function(e) {
            e.stopPropagation();
            const headerIdx = $(this).closest('.toc-item').data('index');
            let sectionStart = headerIdx + 1;
            let sectionEnd = workingList.length;
            for (let i = sectionStart; i < workingList.length; i++) {
                if (workingList[i].type === 'header' || workingList[i].type === 'page') {
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
        }).on('click', function(e) {
            e.stopPropagation(); 
        });
    }

    function clearCardDrag() {
        if (!dragState) return;
        clearTimeout(dragState.holdTimer);
        if (dragState.moveFrame) cancelAnimationFrame(dragState.moveFrame);
        if (dragState.scrollFrame) cancelAnimationFrame(dragState.scrollFrame);
        if (dragState.touch && dragState.active) {
            $list[0].removeEventListener('touchmove', onCardTouchMove);
            $list[0].addEventListener('touchmove', onCardTouchMove, { passive: true });
        }
        dragState.ghost?.remove();
        dragState.dropTarget?.classList.remove('fh-drop-before', 'fh-drop-after');
        $list[0].querySelector('.toc-item.fh-dragging')?.classList.remove('fh-dragging');
        dragState = null;
    }

    function updateDropTarget() {
        if (!dragState?.active) return;
        const target = document.elementFromPoint(dragState.x, dragState.y)?.closest('.toc-item');
        let targetIndex = null;
        let after = false;
        if (target && $list[0].contains(target)) {
            const index = Number(target.dataset.index);
            if (Number.isInteger(index) && index !== dragState.index &&
                !(workingList[dragState.index]._selected && workingList[index]._selected)) {
                const rect = target.getBoundingClientRect();
                after = target.classList.contains('type-header') || target.classList.contains('type-page') || settings.toc_view_mode === 'list'
                    ? dragState.y > rect.top + rect.height / 2
                    : dragState.x > rect.left + rect.width / 2;
                targetIndex = index;
            }
        }
        const nextTarget = targetIndex === null ? null : target;
        if (dragState.dropTarget === nextTarget && dragState.after === after) return;
        dragState.dropTarget?.classList.remove('fh-drop-after', 'fh-drop-before');
        nextTarget?.classList.add(after ? 'fh-drop-after' : 'fh-drop-before');
        dragState.dropTarget = nextTarget;
        dragState.targetIndex = targetIndex;
        dragState.after = after;
    }

    function scrollWhileDragging() {
        if (!dragState?.active) return;
        dragState.scrollFrame = null;
        const rect = dragState.listRect;
        const edge = 55;
        let amount = 0;
        if (dragState.y >= rect.top && dragState.y < rect.top + edge) amount = -14;
        else if (dragState.y <= rect.bottom && dragState.y > rect.bottom - edge) amount = 14;
        if (amount) {
            const scrollElement = getManagerScrollElement($list[0]);
            const before = scrollElement.scrollTop;
            scrollElement.scrollTop += amount;
            if (scrollElement.scrollTop !== before) updateDropTarget();
            dragState.scrollFrame = scrollElement.scrollTop !== before
                ? requestAnimationFrame(scrollWhileDragging) : null;
        }
    }

    function activateCardDrag() {
        if (!dragState || dragState.active) return;
        dragState.active = true;
        dragState.listRect = getManagerScrollElement($list[0]).getBoundingClientRect();
        if (dragState.touch) {
            $list[0].removeEventListener('touchmove', onCardTouchMove);
            $list[0].addEventListener('touchmove', onCardTouchMove, { passive: false });
        }
        const dragged = workingList[dragState.index];
        const count = dragged._selected ? workingList.filter(item => item._selected).length : 1;
        const label = dragged.type === 'header' ? dragged.text : dragged.type === 'page' ? '페이지 나눔' : dragged.name;
        const ghost = document.createElement('div');
        ghost.className = 'fh-toc-drag-ghost';
        ghost.textContent = count > 1 ? `${count}개 항목 이동` : label;
        $overlay[0].append(ghost);
        dragState.ghost = ghost;
        $list.find(`.toc-item[data-index="${dragState.index}"]`).addClass('fh-dragging');
        updateCardDrag(dragState.x, dragState.y);
    }

    function updateCardDrag(x, y) {
        if (!dragState?.active) return;
        dragState.x = x;
        dragState.y = y;
        if (!dragState.moveFrame) dragState.moveFrame = requestAnimationFrame(paintCardDrag);
    }

    function paintCardDrag() {
        if (!dragState?.active) return;
        if (dragState.moveFrame) cancelAnimationFrame(dragState.moveFrame);
        dragState.moveFrame = null;
        dragState.ghost.style.transform = `translate3d(${dragState.x + 14}px, ${dragState.y + 14}px, 0)`;
        updateDropTarget();
        const { top, bottom } = dragState.listRect;
        const nearEdge = (dragState.y >= top && dragState.y < top + 55) ||
            (dragState.y <= bottom && dragState.y > bottom - 55);
        if (nearEdge && !dragState.scrollFrame) dragState.scrollFrame = requestAnimationFrame(scrollWhileDragging);
        else if (!nearEdge && dragState.scrollFrame) {
            cancelAnimationFrame(dragState.scrollFrame);
            dragState.scrollFrame = null;
        }
    }

    function showMovedList(previousOrder) {
        const rows = [...$list[0].querySelectorAll(':scope > .toc-item')];
        if (rows.length !== previousOrder.length || $('#toc_exclude_folders').is(':checked') ||
            ($('#toc_search_input').val() || '').trim()) {
            renderList();
            return;
        }
        hideInfo();
        const rowByItem = new Map(previousOrder.map((item, index) => [item, rows[index]]));
        const fragment = document.createDocumentFragment();
        workingList.forEach((item, index) => {
            const row = rowByItem.get(item);
            row.dataset.index = String(index);
            $(row).data('index', index);
            fragment.appendChild(row);
        });
        $list[0].appendChild(fragment);

        const firstOption = $targetSelect[0].firstElementChild;
        const options = document.createDocumentFragment();
        if (firstOption) options.appendChild(firstOption);
        workingList.forEach((item, index) => {
            if (item.type !== 'header') return;
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `[구분선] ${item.text}`;
            options.appendChild(option);
        });
        $targetSelect[0].replaceChildren(options);
    }

    function finishCardDrag() {
        if (!dragState) return;
        const { index, targetIndex, after, active } = dragState;
        if (active) {
            suppressCardClick = true;
            setTimeout(() => { suppressCardClick = false; }, 350);
        }
        clearCardDrag();
        if (!active || targetIndex === null) return;
        const dragged = workingList[index];
        const moving = dragged._selected ? workingList.filter(item => item._selected) : [dragged];
        const target = workingList[targetIndex];
        const remaining = workingList.filter(item => !moving.includes(item));
        const insertion = remaining.indexOf(target);
        if (insertion < 0) return;
        remaining.splice(insertion + (after ? 1 : 0), 0, ...moving);
        if (remaining.every((item, index) => item === workingList[index])) return;
        const previousOrder = workingList;
        workingList = remaining;
        showMovedList(previousOrder);
    }

    function cardFromEvent(event) {
        if (event.target.closest('input, button, .toc-btn, [contenteditable="true"]')) return null;
        const card = event.target.closest('.toc-item');
        return card && $list[0].contains(card) ? card : null;
    }

    function onCardMouseDown(event) {
        if (event.button !== 0 || Date.now() - lastTouchTime < 700) return;
        const card = cardFromEvent(event);
        if (!card) return;
        dragState = { index: Number(card.dataset.index), x: event.clientX, y: event.clientY,
            startX: event.clientX, startY: event.clientY, active: false, touch: false };
        event.preventDefault();
    }

    function onCardMouseMove(event) {
        if (!dragState || dragState.touch) return;
        if (!dragState.active && Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 5) {
            activateCardDrag();
        }
        updateCardDrag(event.clientX, event.clientY);
    }

    function onCardMouseUp(event) {
        if (!dragState || dragState.touch) return;
        updateCardDrag(event.clientX, event.clientY);
        paintCardDrag();
        finishCardDrag();
    }

    function onCardTouchStart(event) {
        lastTouchTime = Date.now();
        if (event.touches.length !== 1) { clearCardDrag(); return; }
        const card = cardFromEvent(event);
        if (!card) return;
        const touch = event.touches[0];
        dragState = { index: Number(card.dataset.index), x: touch.clientX, y: touch.clientY,
            startX: touch.clientX, startY: touch.clientY, active: false, touch: true };
        dragState.holdTimer = setTimeout(activateCardDrag, 280);
    }

    function onCardTouchMove(event) {
        if (!dragState?.touch) return;
        if (event.touches.length !== 1) { clearCardDrag(); return; }
        const touch = event.touches[0];
        if (!dragState.active) {
            if (Math.hypot(touch.clientX - dragState.startX, touch.clientY - dragState.startY) > 10) clearCardDrag();
            else { dragState.x = touch.clientX; dragState.y = touch.clientY; }
            return;
        }
        event.preventDefault();
        updateCardDrag(touch.clientX, touch.clientY);
    }

    function onCardTouchEnd(event) {
        if (!dragState?.touch) return;
        const touch = event.changedTouches[0];
        if (touch && dragState.active) {
            updateCardDrag(touch.clientX, touch.clientY);
            paintCardDrag();
        }
        finishCardDrag();
    }

    function onCardClickCapture(event) {
        if (!suppressCardClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressCardClick = false;
    }

    function onCardContextMenu(event) {
        if (dragState?.touch && !event.target.closest('[contenteditable="true"]')) event.preventDefault();
    }

    function addCardDragListeners() {
        const list = $list[0];
        list.addEventListener('mousedown', onCardMouseDown);
        document.addEventListener('mousemove', onCardMouseMove);
        document.addEventListener('mouseup', onCardMouseUp);
        list.addEventListener('touchstart', onCardTouchStart, { passive: true });
        list.addEventListener('touchmove', onCardTouchMove, { passive: true });
        list.addEventListener('touchend', onCardTouchEnd);
        list.addEventListener('touchcancel', clearCardDrag);
        list.addEventListener('click', onCardClickCapture, true);
        list.addEventListener('contextmenu', onCardContextMenu);
    }

    function removeCardDragListeners() {
        clearCardDrag();
        const list = $list[0];
        list.removeEventListener('mousedown', onCardMouseDown);
        document.removeEventListener('mousemove', onCardMouseMove);
        document.removeEventListener('mouseup', onCardMouseUp);
        list.removeEventListener('touchstart', onCardTouchStart);
        list.removeEventListener('touchmove', onCardTouchMove);
        list.removeEventListener('touchend', onCardTouchEnd);
        list.removeEventListener('touchcancel', clearCardDrag);
        list.removeEventListener('click', onCardClickCapture, true);
        list.removeEventListener('contextmenu', onCardContextMenu);
    }

    renderList();
    addCardDragListeners();
    $('.fh-toc-view-btn').on('click', function() {
        const nextView = this.dataset.view === 'list' ? 'list' : 'card';
        if (settings.toc_view_mode === nextView) return;
        settings.toc_view_mode = nextView;
        $list.toggleClass('fh-list-view', settings.toc_view_mode === 'list');
        $overlay.find('.fh-toc-view-btn').each(function() {
            $(this).toggleClass('active', this.dataset.view === settings.toc_view_mode);
        });
        saveSettingsDebounced();
    });
    $overlay.find('.fh-toc-view-btn').each(function() {
        $(this).toggleClass('active', this.dataset.view === settings.toc_view_mode);
    });

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
            delete settings.toc[contextLookup.key || contextId];
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
    $('.add-page-btn').click(() => {
        const selected = workingList.map((item, index) => item._selected ? index : -1).filter(index => index >= 0);
        if (selected.length !== 1) return alert('페이지가 끝날 항목 하나를 선택한 뒤 페이지 나눔을 눌러주세요.');
        const index = selected[0];
        if (index >= workingList.length - 1) return alert('마지막 항목 뒤에는 새 페이지를 만들 수 없습니다.');
        if (workingList[index + 1].type === 'page') return alert('이미 이 위치에 페이지 나눔이 있습니다.');
        workingList[index]._selected = false;
        workingList.splice(index + 1, 0, { type: 'page', id: `page_${Date.now()}` });
        renderList();
    });
    $('.close-toc-btn').click(closePopup);
    
    $('.save-toc-btn').click(() => {
        if (workingList[0]?.type === 'page' || workingList.at(-1)?.type === 'page' ||
            workingList.some((item, index) => item.type === 'page' && workingList[index + 1]?.type === 'page')) {
            return alert('페이지 나눔은 목록 처음·끝이나 연속된 위치에 둘 수 없습니다. 위치를 조정해주세요.');
        }
        const excludeFolders = $('#toc_exclude_folders').is(':checked');
        const saveItems = workingList.map(item => {
            if (item.type === 'header') return { type: 'header', text: item.text };
            if (item.type === 'page') return { type: 'page' };
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
    const contextInfo = getCurrentContextInfo();
    const contextId = contextInfo.id;
    const $container = $('#rm_print_characters_block');
    const items = getDomItems($container);
    let currentToc = getTocConfigForContext(contextInfo, items).config;
    let isAutoGenerated = false;

    if (!currentToc) {
        const capturedItems = items.map(item => ({
            type: item.type,
            id: item.id
        }));

        currentToc = {
            excludeFolders: true, 
            folderName: contextId === 'root' ? 'Main List' : contextInfo.name,
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

function onExportAllSettings() {
    $('#setting_backup_area').val(JSON.stringify({
        ...settings,
        version: 3,
        type: 'full_backup',
    }));
}

function onImportSettings() {
    const jsonStr = $('#setting_backup_area').val().trim();
    if (!jsonStr) { alert('내용이 없습니다.'); return; }

    try {
        const parsed = JSON.parse(jsonStr);

        // 1. 신규 방식: 특정 목록(폴더)만 백업한 데이터인 경우
        if (parsed?.type === 'context_backup' && typeof parsed.contextId === 'string' &&
            !['__proto__', 'constructor', 'prototype'].includes(parsed.contextId) &&
            parsed.data && typeof parsed.data === 'object' && Array.isArray(parsed.data.items)) {
            const targetId = parsed.contextId;
            const targetName = parsed.data.folderName || targetId;

            if (confirm(`[${targetName}] 목록의 설정을 불러옵니다.\n\n이 작업은 다른 폴더의 설정은 건드리지 않고,\n현재 보고 있는 목록(또는 지정된 폴더)의 순서만 변경합니다.\n진행하시겠습니까?`)) {
                
                settings.toc[targetId] = normalizeTocConfig(parsed.data);
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
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.toc) {
            throw new Error('Invalid FolderHider backup');
        }
        if (!confirm('경고: 전체 설정 백업본으로 보입니다.\n\n이 데이터를 불러오면 "모든 폴더"의 숨김 설정과 순서가\n이 파일의 내용으로 완전히 덮어씌워집니다.\n\n진행하시겠습니까?')) return;
        
        const fixItems = (items) => {
            if (!Array.isArray(items)) return [];
            return items.map(item => {
                if (item && item.type === 'char' && typeof item.id === 'string') {
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

        settings = normalizeSettings(parsed);
        extension_settings[extensionName] = settings;
        saveSettingsDebounced();

        $('#folder_hider_enable_toggle').prop('checked', settings.enabled);
        currentPersonaFolder = settings.last_persona_folder;
        renderPersonaTabs();
        applyPersonaFolderFilter();
        themeManager.applyTheme(settings.theme);
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
    if (settings.last_persona_folder) {
        currentPersonaFolder = settings.last_persona_folder;
    }

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
    const previousScrollLeft = $bar.scrollLeft();
    $bar.empty();

    // 1. 기본 탭
    const allActive = currentPersonaFolder === 'All' ? 'active' : '';
    $bar.append(`<div class="persona-folder-tab ${allActive}" data-folder="All"><i class="fa-solid fa-layer-group"></i> 전체</div>`);

    // 2. 미분류 탭
    const uncActive = currentPersonaFolder === 'Uncategorized' ? 'active' : '';
    $bar.append(`<div class="persona-folder-tab ${uncActive}" data-folder="Uncategorized"><i class="fa-regular fa-folder"></i> 미분류</div>`);

    // 3. 사용자 정의 폴더 탭
    const folders = settings.persona_folder_order;
    folders.forEach(folder => {
        const isActive = currentPersonaFolder === folder ? 'active' : '';
        $bar.append(`<div class="persona-folder-tab ${isActive}" data-folder="${escapeHtml(folder)}"><i class="fa-solid fa-folder"></i> ${escapeHtml(folder)}</div>`);
    });

    // 4. 편집 버튼
    $bar.append(`<div class="persona-folder-settings-btn" role="button" tabindex="0" title="페르소나 폴더 관리" aria-label="페르소나 폴더 관리"><i class="fa-solid fa-gear"></i></div>`);

    $bar.find('.persona-folder-tab').click(function() {
        const nextFolder = $(this).attr('data-folder');
        if (nextFolder === currentPersonaFolder) return;
        currentPersonaFolder = nextFolder;

        settings.last_persona_folder = currentPersonaFolder;
        saveSettingsDebounced();

        $bar.find('.persona-folder-tab').removeClass('active');
        $(this).addClass('active');
        applyPersonaFolderFilter();
    });

    $bar.find('.persona-folder-settings-btn').click(openPersonaFolderEditor);
    $bar.find('.persona-folder-settings-btn').on('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPersonaFolderEditor(); }
    });

    const barEl = $bar[0];
    barEl.scrollLeft = previousScrollLeft;
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
function openPersonaFolderEditor() {
    if ($('#fh_persona_folder_editor').length) return;
    const $overlay = $(`
        <div class="toc-manager-overlay" id="fh_persona_folder_editor">
            <div class="fh-folder-editor" role="dialog" aria-modal="true" aria-labelledby="fh_folder_editor_title" tabindex="-1">
                <div class="fh-folder-editor-header">
                    <strong id="fh_folder_editor_title">페르소나 폴더 관리</strong>
                    <button type="button" class="fh-folder-editor-close" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="fh-folder-editor-main">
                    <label for="fh_folder_new_name">새 폴더</label>
                    <div class="fh-folder-editor-add">
                        <input id="fh_folder_new_name" type="text" placeholder="폴더 이름 입력" autocomplete="off">
                        <button type="button" class="fh-folder-editor-primary" id="fh_folder_add">추가</button>
                    </div>
                    <div class="fh-folder-editor-message" role="status" aria-live="polite"></div>
                    <div class="fh-folder-editor-list" aria-label="기존 폴더"></div>
                </div>
                <div class="fh-folder-editor-footer"><button type="button" class="fh-folder-editor-done">완료</button></div>
            </div>
        </div>
    `);
    const $list = $overlay.find('.fh-folder-editor-list');
    const $message = $overlay.find('.fh-folder-editor-message');

    function setMessage(message, isError = false) {
        $message.text(message).toggleClass('is-error', isError);
    }
    function validateName(name, oldName = null) {
        if (!name) return '폴더 이름을 입력하세요.';
        if (['All', 'Uncategorized', '__remove__', '__proto__', 'constructor', 'prototype'].includes(name)) {
            return '사용할 수 없는 폴더 이름입니다.';
        }
        if (name !== oldName && Object.hasOwn(settings.persona_folders, name)) return '이미 있는 폴더 이름입니다.';
        return null;
    }
    function renderFolders() {
        const folders = settings.persona_folder_order;
        if (!folders.length) {
            $list.html('<div class="fh-folder-editor-row">아직 만든 폴더가 없습니다.</div>');
            return;
        }
        $list.html(folders.map((folder, index) => `
            <div class="fh-folder-editor-row" data-folder="${escapeHtml(folder)}">
                <div class="fh-folder-editor-label"><i class="fa-solid fa-folder"></i> ${escapeHtml(folder)}
                    <span class="fh-folder-editor-count">${settings.persona_folders[folder].length}개</span>
                </div>
                <div class="fh-folder-editor-actions">
                    <div class="fh-folder-editor-order" role="group" aria-label="${escapeHtml(folder)} 순서 이동">
                        <button type="button" data-action="up" title="위로 이동" aria-label="${escapeHtml(folder)} 위로 이동" ${index === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" data-action="down" title="아래로 이동" aria-label="${escapeHtml(folder)} 아래로 이동" ${index === folders.length - 1 ? 'disabled' : ''}>↓</button>
                    </div>
                    <button type="button" data-action="rename">이름 변경</button>
                    <button type="button" class="fh-folder-editor-danger" data-action="delete">삭제</button>
                </div>
            </div>`).join(''));
    }
    function close() {
        $(document).off('keydown.fhfoldereditor');
        $overlay.remove();
        $('#persona_folder_bar .persona-folder-settings-btn').trigger('focus');
    }
    function addFolder() {
        const $input = $overlay.find('#fh_folder_new_name');
        const name = $input.val().trim();
        const error = validateName(name);
        if (error) { setMessage(error, true); $input.trigger('focus'); return; }
        settings.persona_folders[name] = [];
        settings.persona_folder_order.push(name);
        saveSettingsDebounced();
        renderPersonaTabs();
        renderFolders();
        $input.val('').trigger('focus');
        setMessage(`[${name}] 폴더를 추가했습니다.`);
    }

    renderFolders();
    $('body').append($overlay);
    $overlay.find('.fh-folder-editor').trigger('focus');
    $overlay.on('mousedown click pointerdown', e => e.stopPropagation());
    $overlay.on('click', e => { if (e.target === $overlay[0]) close(); });
    $overlay.find('.fh-folder-editor-close, .fh-folder-editor-done').on('click', close);
    $overlay.find('#fh_folder_add').on('click', addFolder);
    $overlay.find('#fh_folder_new_name').on('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addFolder(); }
    });
    $(document).on('keydown.fhfoldereditor', e => { if (e.key === 'Escape') close(); });

    $list.on('click', 'button[data-action="rename"], button[data-action="delete"]', function() {
        const $row = $(this).closest('.fh-folder-editor-row');
        const folder = $row.attr('data-folder');
        if (!Object.hasOwn(settings.persona_folders, folder)) return;
        const action = this.dataset.action;
        renderFolders();
        const $targetRow = $list.find('.fh-folder-editor-row').filter(function() { return this.dataset.folder === folder; });
        $targetRow.find('.fh-folder-editor-actions').hide();
        if (action === 'rename') {
            const $inline = $(`<div class="fh-folder-editor-inline">
                <input type="text" aria-label="새 폴더 이름">
                <button type="button" class="fh-folder-editor-primary" data-action="save-rename">저장</button>
                <button type="button" data-action="cancel">취소</button>
            </div>`);
            $inline.find('input').val(folder);
            $targetRow.append($inline);
            $inline.find('input').trigger('focus')[0].select();
        } else if (action === 'delete') {
            $targetRow.append(`<div class="fh-folder-editor-inline">
                <span class="fh-folder-editor-inline-note">[${escapeHtml(folder)}] 폴더만 삭제합니다. 페르소나는 유지됩니다.</span>
                <button type="button" class="fh-folder-editor-danger" data-action="confirm-delete">삭제 확인</button>
                <button type="button" data-action="cancel">취소</button>
            </div>`);
        }
    });
    $list.on('click', 'button[data-action="cancel"]', renderFolders);
    $list.on('click', 'button[data-action="up"], button[data-action="down"]', function() {
        const folder = $(this).closest('.fh-folder-editor-row').attr('data-folder');
        const order = settings.persona_folder_order;
        const index = order.indexOf(folder);
        const movingUp = this.dataset.action === 'up';
        const nextIndex = index + (movingUp ? -1 : 1);
        if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
        const adjacentFolder = order[nextIndex];
        const editorRow = this.closest('.fh-folder-editor-row');
        const adjacentRow = movingUp ? editorRow.previousElementSibling : editorRow.nextElementSibling;
        const bar = document.getElementById('persona_folder_bar');
        const tabs = [...bar.querySelectorAll('.persona-folder-tab')];
        const currentTab = tabs.find(tab => tab.dataset.folder === folder);
        const adjacentTab = tabs.find(tab => tab.dataset.folder === adjacentFolder);
        [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
        if (adjacentRow) {
            if (movingUp) editorRow.parentNode.insertBefore(editorRow, adjacentRow);
            else editorRow.parentNode.insertBefore(adjacentRow, editorRow);
        }
        if (currentTab && adjacentTab) {
            if (movingUp) bar.insertBefore(currentTab, adjacentTab);
            else bar.insertBefore(adjacentTab, currentTab);
        }
        $list.find('.fh-folder-editor-row').each(function(position) {
            $(this).find('[data-action="up"]').prop('disabled', position === 0);
            $(this).find('[data-action="down"]').prop('disabled', position === order.length - 1);
        });
        saveSettingsDebounced();
    });
    $list.on('click', 'button[data-action="save-rename"]', function() {
        const $row = $(this).closest('.fh-folder-editor-row');
        const oldName = $row.attr('data-folder');
        if (!Object.hasOwn(settings.persona_folders, oldName)) return;
        const name = $row.find('input').val().trim();
        const error = validateName(name, oldName);
        if (error) { setMessage(error, true); $row.find('input').trigger('focus'); return; }
        if (name !== oldName) {
            settings.persona_folders[name] = settings.persona_folders[oldName];
            delete settings.persona_folders[oldName];
            const orderIndex = settings.persona_folder_order.indexOf(oldName);
            if (orderIndex >= 0) settings.persona_folder_order[orderIndex] = name;
            else settings.persona_folder_order.push(name);
            if (currentPersonaFolder === oldName) currentPersonaFolder = name;
            if (settings.last_persona_folder === oldName) settings.last_persona_folder = name;
            saveSettingsDebounced();
            renderPersonaTabs();
            applyPersonaFolderFilter();
        }
        renderFolders();
        setMessage(name === oldName ? '변경 사항이 없습니다.' : `[${oldName}] 폴더 이름을 [${name}](으)로 변경했습니다.`);
    });
    $list.on('click', 'button[data-action="confirm-delete"]', function() {
        const folder = $(this).closest('.fh-folder-editor-row').attr('data-folder');
        if (!Object.hasOwn(settings.persona_folders, folder)) return;
        delete settings.persona_folders[folder];
        settings.persona_folder_order = settings.persona_folder_order.filter(name => name !== folder);
        if (currentPersonaFolder === folder) currentPersonaFolder = 'All';
        if (settings.last_persona_folder === folder) settings.last_persona_folder = 'All';
        saveSettingsDebounced();
        renderPersonaTabs();
        applyPersonaFolderFilter();
        renderFolders();
        setMessage(`[${folder}] 폴더를 삭제했습니다.`);
    });
    $list.on('keydown', '.fh-folder-editor-inline input', e => {
        if (e.key === 'Enter') { e.preventDefault(); $(e.currentTarget).siblings('[data-action="save-rename"]').trigger('click'); }
        if (e.key === 'Escape') { e.stopPropagation(); renderFolders(); }
    });
}

function connectPersonaObserver() {
    const target = document.getElementById('user_avatar_block');

    if (!target) return; 

    if (personaListObserver) personaListObserver.disconnect();
    personaAvatarIndex = null;
    visiblePersonaAvatars = null;

    personaListObserver = new MutationObserver(() => {
        personaAvatarIndex = null;
        visiblePersonaAvatars = null;
        if (personaFilterRaf) cancelAnimationFrame(personaFilterRaf);
        personaFilterRaf = requestAnimationFrame(() => {
            personaFilterRaf = null;
            applyPersonaFolderFilter();
        });
    });

    personaListObserver.observe(target, { childList: true, subtree: false });
    
    applyPersonaFolderFilter();
}

function applyPersonaFolderFilter() {
    if (!personaAvatarIndex) {
        const avatars = [...document.querySelectorAll('#user_avatar_block .avatar-container')];
        const byId = new Map();
        for (const avatar of avatars) {
            const id = avatar.getAttribute('data-avatar-id');
            if (!byId.has(id)) byId.set(id, []);
            byId.get(id).push(avatar);
        }
        personaAvatarIndex = { avatars, byId };
        visiblePersonaAvatars = new Set(avatars.filter(avatar => !avatar.classList.contains(HIDDEN_CLASS)));
    }
    const { avatars, byId } = personaAvatarIndex;
    const showAll = currentPersonaFolder === 'All';
    let nextVisible;
    if (showAll) {
        nextVisible = new Set(avatars);
    } else if (currentPersonaFolder === 'Uncategorized') {
        const categorized = new Set(Object.values(settings.persona_folders).flat());
        nextVisible = new Set(avatars.filter(avatar => !categorized.has(avatar.getAttribute('data-avatar-id'))));
    } else {
        nextVisible = new Set();
        for (const id of settings.persona_folders[currentPersonaFolder] || []) {
            for (const avatar of byId.get(id) || []) nextVisible.add(avatar);
        }
    }
    for (const avatar of visiblePersonaAvatars) {
        if (!nextVisible.has(avatar)) avatar.classList.add(HIDDEN_CLASS);
    }
    for (const avatar of nextVisible) {
        if (!visiblePersonaAvatars.has(avatar)) avatar.classList.remove(HIDDEN_CLASS);
    }
    visiblePersonaAvatars = nextVisible;
}

// =========================================================================
// 6. Logic: Persona Bulk Manager Popup
// =========================================================================

async function openPersonaBulkManager() {
    if ($('#persona_manager_popup').length) return;
    const $overlay = $('<div class="toc-manager-overlay" id="persona_manager_popup"></div>');
    const folderOptions = settings.persona_folder_order.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
    const dropTargetsHtml = `<button type="button" class="pm-drop-target" data-folder="__remove__">미분류</button>` +
        settings.persona_folder_order.map(f =>
            `<button type="button" class="pm-drop-target" data-folder="${escapeHtml(f)}">${escapeHtml(f)}</button>`).join('');
    
const popupHtml = `
        <div class="toc-manager-modal" id="pm_modal_inner" style="max-width: 1000px;">
            <div class="toc-header" style="display:flex; align-items:center; justify-content:space-between; padding: 18px 24px; border-bottom: 1px solid var(--fh-border);">
                <span style="font-size:1.1rem; font-weight:700; letter-spacing:-0.3px;">페르소나 폴더 일괄 관리</span>
                <button type="button" class="fh-manager-close close-popup-btn" aria-label="페르소나 관리 닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
            <div class="fh-manager-content">
            <div class="toc-toolbar" style="padding: 16px 24px; border-bottom: 1px solid var(--fh-border); display:flex; flex-direction:column; gap:10px;">
                <div class="toc-toolbar-row fh-pm-search-controls" style="display:flex; gap:8px; align-items:center;">
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
                    <div class="fh-pm-selection-controls" style="display:flex; align-items:center; gap: 8px;">
                        <div class="fh-selection-actions">
                        <button id="pm_select_all" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">전체선택</button>
                        <button id="pm_deselect_all" style="padding: 6px 14px; border-radius:7px; font-size:0.85rem; font-weight:600;">해제</button>
                        </div>
                        <div class="fh-toolbar-divider" style="width:1px; height:20px; background:var(--fh-border); margin:0 4px;"></div>
                        <label class="fh-image-toggle" style="cursor:pointer; display:flex; align-items:center; gap:5px; font-weight:600; font-size:0.9rem; color:var(--fh-text); opacity:0.8;">
                            <input type="checkbox" id="pm_toggle_images" checked> 🖼️ 이미지 표시
                        </label>
                        <div class="fh-view-switch" role="group" aria-label="페르소나 보기 방식">
                            <button type="button" class="fh-pm-view-btn" data-view="card">▦ 카드</button>
                            <button type="button" class="fh-pm-view-btn" data-view="list">☰ 리스트</button>
                        </div>
                    </div>
                    <div class="fh-pm-move-controls fh-manager-move-controls" style="display:flex; gap:8px; align-items:center;">
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
            <div id="pm_drop_targets" aria-label="페르소나 이동 대상 폴더">${dropTargetsHtml}</div>

            <div class="toc-body" id="pm_list_body" style="padding: 16px 24px; overflow-y:auto;">
                <!-- 리스트 주입됨 -->
            </div>
            </div>
            <div class="toc-footer" style="display:flex; align-items:center; justify-content:flex-end; gap:10px; padding: 14px 24px; border-top: 1px solid var(--fh-border);">
                <small id="pm_status" style="margin-right:auto; color:var(--fh-text); opacity:0.7; font-size:0.82rem;">카드를 길게 누르거나 끌어서 위 폴더로 이동할 수 있습니다.</small>
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
    const $pmList = $overlay.find('#pm_list_body');
    let pmDragState = null;
    let pmSuppressClick = false;
    let pmLastTouchTime = 0;

    const unbindViewport = bindManagerViewport($overlay[0]);

    const close = () => {
        unbindViewport();
        removePersonaDragListeners();
        $overlay.remove();
        renderPersonaTabs(); 
        applyPersonaFolderFilter(); 
    };
    $overlay.find('.close-popup-btn').click(close);

    const allPersonas = [];
    let personaIds;
    try {
        personaIds = await getUserAvatars(false);
    } catch (error) {
        console.error('[FolderHider] Failed to load personas:', error);
        close();
        alert('페르소나 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    if (!Array.isArray(personaIds)) {
        close();
        alert('페르소나 목록 형식이 올바르지 않습니다.');
        return;
    }
    for (const id of personaIds) {
        const name = String(power_user.personas[id] || '[Unnamed Persona]');
        const addInfo = String(power_user.persona_descriptions[id]?.title || '');
        const imgSrc = getThumbnailUrl('persona', id);
        
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
        allPersonas.push({ id, name, addInfo, imgSrc, lang, folders: myFolders });
    }

    const renderList = () => {
        clearPersonaDrag();
        const $list = $pmList;
        const scrollElement = getManagerScrollElement($list[0]);
        const scrollTop = scrollElement.scrollTop;
        $list.empty();
        $list.toggleClass('fh-list-view', settings.persona_view_mode === 'list');

        const searchQuery = $('#pm_search_input').val().toLowerCase();
        const filterFolder = $('#pm_filter_folder').val();
        const filterLang = $('#pm_filter_lang').val();
        const showImages = $('#pm_toggle_images').is(':checked');
        const htmlParts = [];

        allPersonas.forEach((p, idx) => {
            if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.addInfo.toLowerCase().includes(searchQuery)) return;
            if (filterLang && p.lang !== filterLang) return;

            if (filterFolder === '__uncategorized__') {
                if (p.folders.length > 0) return;
            } else if (filterFolder && filterFolder !== '') {
                if (!p.folders.includes(filterFolder)) return;
            }

            const folderBadges = p.folders.length
                ? p.folders.map(f => `<span class="persona-folder-badge"><i class="fa-solid fa-folder" style="margin-right:3px;"></i>${escapeHtml(f)}</span>`).join('')
                : '<span class="persona-folder-badge">미분류</span>';
            const isSelected = p._selected ? 'selected' : '';
            const checked = p._selected ? 'checked' : '';
            const imgHtml = p.imgSrc
                ? `<img src="${escapeHtml(p.imgSrc)}" class="pm-avatar-img" alt="" loading="lazy" decoding="async" draggable="false">`
                : '<div class="toc-avatar-placeholder"><i class="fa-solid fa-user"></i></div>';
            const addInfoHtml = p.addInfo ? `<span class="pm-add-info">${escapeHtml(p.addInfo)}</span>` : '';
            htmlParts.push(`
                <div class="toc-item pm-card ${isSelected}" data-idx="${idx}">
                    ${showImages ? `<div class="pm-card-media">
                        ${imgHtml}
                        <input type="checkbox" class="toc-item-checkbox" ${checked}>
                    </div>` : `<div class="pm-compact-check"><input type="checkbox" class="toc-item-checkbox" ${checked}></div>`}
                    <div class="pm-card-body">
                        <span class="pm-card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
                        ${addInfoHtml}
                        <div class="pm-folder-badges">${folderBadges}</div>
                    </div>
                </div>`);
        });

        if (htmlParts.length) $list.append(htmlParts.join(''));
        scrollElement.scrollTop = scrollTop;
        $list.find('.toc-item').click(function(e) {
            if ($(e.target).closest('input').length) return;
            const idx = $(this).data('idx');
            allPersonas[idx]._selected = !allPersonas[idx]._selected;
            $(this).toggleClass('selected');
            $(this).find('.toc-item-checkbox').prop('checked', allPersonas[idx]._selected);
            const count = allPersonas.filter(p => p._selected).length;
            setPersonaStatus(count ? `${count}개 선택됨 · 위 폴더를 누르면 이동합니다.` : '선택하지 않고 폴더를 누르면 해당 목록을 봅니다.');
        });
        $list.find('.toc-item-checkbox').change(function() {
            const $item = $(this).closest('.toc-item');
            const idx = $item.data('idx');
            allPersonas[idx]._selected = $(this).is(':checked');
            $item.toggleClass('selected', allPersonas[idx]._selected);
            const count = allPersonas.filter(p => p._selected).length;
            setPersonaStatus(count ? `${count}개 선택됨 · 위 폴더를 누르면 이동합니다.` : '선택하지 않고 폴더를 누르면 해당 목록을 봅니다.');
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

    function setPersonaStatus(message) {
        $overlay.find('#pm_status').text(message);
    }

    function movePersonas(selectedItems, targetFolder) {
        if (!selectedItems.length) {
            setPersonaStatus('이동할 페르소나를 먼저 선택하세요.');
            return;
        }
        if (targetFolder !== '__remove__' && !Object.hasOwn(settings.persona_folders, targetFolder)) {
            setPersonaStatus('이동할 폴더를 선택하세요.');
            return;
        }
        let count = 0;
        selectedItems.forEach(p => {
            const nextFolders = targetFolder === '__remove__' ? [] : [targetFolder];
            if (p.folders.length !== nextFolders.length || p.folders.some((name, i) => name !== nextFolders[i])) count++;
            for (const list of Object.values(settings.persona_folders)) {
                let idx;
                while ((idx = list.indexOf(p.id)) !== -1) list.splice(idx, 1);
            }
            if (targetFolder !== '__remove__') settings.persona_folders[targetFolder].push(p.id);
            p.folders = nextFolders;
            p._selected = false;
        });
        if (count) saveSettingsDebounced();
        renderList();
        setPersonaStatus(count ? `${count}개의 페르소나를 이동했습니다.` : '선택한 페르소나는 이미 그 폴더에 있습니다.');
    }

    $('#pm_execute_move').click(() => {
        const targetFolder = $('#pm_target_folder').val();
        if (!targetFolder) return setPersonaStatus('이동할 폴더를 선택하세요.');
        movePersonas(allPersonas.filter(p => p._selected), targetFolder);
    });
    $overlay.find('.pm-drop-target').on('click', function() {
        const selected = allPersonas.filter(p => p._selected);
        if (selected.length) {
            movePersonas(selected, this.dataset.folder);
        } else {
            const folder = this.dataset.folder === '__remove__' ? '__uncategorized__' : this.dataset.folder;
            const wasActive = this.classList.contains('fh-filter-active');
            $overlay.find('#pm_filter_folder').val(wasActive ? '' : folder);
            $overlay.find('.pm-drop-target').removeClass('fh-filter-active');
            if (!wasActive) this.classList.add('fh-filter-active');
            renderList();
        }
    });
    $overlay.find('#pm_filter_folder').on('change', function() {
        $overlay.find('.pm-drop-target').removeClass('fh-filter-active');
        const folder = this.value === '__uncategorized__' ? '__remove__' : this.value;
        if (folder) $overlay.find('.pm-drop-target').filter(function() { return this.dataset.folder === folder; }).addClass('fh-filter-active');
    });
    $overlay.find('.fh-pm-view-btn').on('click', function() {
        const nextView = this.dataset.view === 'list' ? 'list' : 'card';
        if (settings.persona_view_mode === nextView) return;
        settings.persona_view_mode = nextView;
        $pmList.toggleClass('fh-list-view', settings.persona_view_mode === 'list');
        $overlay.find('.fh-pm-view-btn').each(function() {
            $(this).toggleClass('active', this.dataset.view === settings.persona_view_mode);
        });
        saveSettingsDebounced();
    });
    $overlay.find('.fh-pm-view-btn').each(function() {
        $(this).toggleClass('active', this.dataset.view === settings.persona_view_mode);
    });

    function clearPersonaDrag() {
        if (!pmDragState) return;
        clearTimeout(pmDragState.holdTimer);
        if (pmDragState.moveFrame) cancelAnimationFrame(pmDragState.moveFrame);
        if (pmDragState.touch && pmDragState.active) {
            $pmList[0].removeEventListener('touchmove', onPersonaTouchMove);
            $pmList[0].addEventListener('touchmove', onPersonaTouchMove, { passive: true });
        }
        pmDragState.ghost?.remove();
        $pmList[0].querySelector('.pm-card.fh-dragging')?.classList.remove('fh-dragging');
        pmDragState.dropTarget?.classList.remove('fh-drop-active');
        pmDragState = null;
    }

    function updatePersonaDrag(x, y) {
        if (!pmDragState?.active) return;
        pmDragState.x = x;
        pmDragState.y = y;
        if (!pmDragState.moveFrame) pmDragState.moveFrame = requestAnimationFrame(paintPersonaDrag);
    }

    function paintPersonaDrag() {
        if (!pmDragState?.active) return;
        if (pmDragState.moveFrame) cancelAnimationFrame(pmDragState.moveFrame);
        pmDragState.moveFrame = null;
        pmDragState.ghost.style.transform = `translate3d(${pmDragState.x + 14}px, ${pmDragState.y + 14}px, 0)`;
        const { x, y } = pmDragState;
        const target = document.elementFromPoint(x, y)?.closest('.pm-drop-target');
        const nextTarget = target && $overlay[0].contains(target) ? target : null;
        if (pmDragState.dropTarget === nextTarget) return;
        pmDragState.dropTarget?.classList.remove('fh-drop-active');
        nextTarget?.classList.add('fh-drop-active');
        pmDragState.dropTarget = nextTarget;
        pmDragState.targetFolder = nextTarget?.dataset.folder || null;
    }

    function activatePersonaDrag() {
        if (!pmDragState || pmDragState.active) return;
        pmDragState.active = true;
        if (pmDragState.touch) {
            $pmList[0].removeEventListener('touchmove', onPersonaTouchMove);
            $pmList[0].addEventListener('touchmove', onPersonaTouchMove, { passive: false });
        }
        const persona = allPersonas[pmDragState.index];
        const count = persona._selected ? allPersonas.filter(p => p._selected).length : 1;
        const ghost = document.createElement('div');
        ghost.className = 'fh-toc-drag-ghost';
        ghost.textContent = count > 1 ? `${count}개 페르소나 이동` : persona.name;
        $overlay[0].append(ghost);
        pmDragState.ghost = ghost;
        $pmList.find(`.pm-card[data-idx="${pmDragState.index}"]`).addClass('fh-dragging');
        updatePersonaDrag(pmDragState.x, pmDragState.y);
    }

    function finishPersonaDrag() {
        if (!pmDragState) return;
        const { index, active, targetFolder } = pmDragState;
        if (active) {
            pmSuppressClick = true;
            setTimeout(() => { pmSuppressClick = false; }, 350);
        }
        clearPersonaDrag();
        if (!active || !targetFolder) return;
        const persona = allPersonas[index];
        const moving = persona._selected ? allPersonas.filter(p => p._selected) : [persona];
        movePersonas(moving, targetFolder);
    }

    function personaCardFromEvent(event) {
        if (event.target.closest('input, button')) return null;
        const card = event.target.closest('.pm-card');
        return card && $pmList[0].contains(card) ? card : null;
    }

    function onPersonaMouseDown(event) {
        if (event.button !== 0 || Date.now() - pmLastTouchTime < 700) return;
        const card = personaCardFromEvent(event);
        if (!card) return;
        pmDragState = { index: Number(card.dataset.idx), startX: event.clientX, startY: event.clientY,
            x: event.clientX, y: event.clientY, active: false, touch: false };
        event.preventDefault();
    }

    function onPersonaMouseMove(event) {
        if (!pmDragState || pmDragState.touch) return;
        if (!pmDragState.active && Math.hypot(event.clientX - pmDragState.startX, event.clientY - pmDragState.startY) > 5) {
            activatePersonaDrag();
        }
        updatePersonaDrag(event.clientX, event.clientY);
    }

    function onPersonaMouseUp(event) {
        if (!pmDragState || pmDragState.touch) return;
        updatePersonaDrag(event.clientX, event.clientY);
        paintPersonaDrag();
        finishPersonaDrag();
    }

    function onPersonaTouchStart(event) {
        pmLastTouchTime = Date.now();
        if (event.touches.length !== 1) { clearPersonaDrag(); return; }
        const card = personaCardFromEvent(event);
        if (!card) return;
        const touch = event.touches[0];
        pmDragState = { index: Number(card.dataset.idx), startX: touch.clientX, startY: touch.clientY,
            x: touch.clientX, y: touch.clientY, active: false, touch: true };
        pmDragState.holdTimer = setTimeout(activatePersonaDrag, 280);
    }

    function onPersonaTouchMove(event) {
        if (!pmDragState?.touch) return;
        if (event.touches.length !== 1) { clearPersonaDrag(); return; }
        const touch = event.touches[0];
        if (!pmDragState.active) {
            if (Math.hypot(touch.clientX - pmDragState.startX, touch.clientY - pmDragState.startY) > 10) clearPersonaDrag();
            else { pmDragState.x = touch.clientX; pmDragState.y = touch.clientY; }
            return;
        }
        event.preventDefault();
        updatePersonaDrag(touch.clientX, touch.clientY);
    }

    function onPersonaTouchEnd(event) {
        if (!pmDragState?.touch) return;
        const touch = event.changedTouches[0];
        if (touch && pmDragState.active) {
            updatePersonaDrag(touch.clientX, touch.clientY);
            paintPersonaDrag();
        }
        finishPersonaDrag();
    }

    function onPersonaClickCapture(event) {
        if (!pmSuppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        pmSuppressClick = false;
    }

    function onPersonaContextMenu(event) {
        if (pmDragState?.touch) event.preventDefault();
    }

    function addPersonaDragListeners() {
        const list = $pmList[0];
        list.addEventListener('mousedown', onPersonaMouseDown);
        document.addEventListener('mousemove', onPersonaMouseMove);
        document.addEventListener('mouseup', onPersonaMouseUp);
        list.addEventListener('touchstart', onPersonaTouchStart, { passive: true });
        list.addEventListener('touchmove', onPersonaTouchMove, { passive: true });
        list.addEventListener('touchend', onPersonaTouchEnd);
        list.addEventListener('touchcancel', clearPersonaDrag);
        list.addEventListener('contextmenu', onPersonaContextMenu);
        list.addEventListener('click', onPersonaClickCapture, true);
        $overlay.find('#pm_drop_targets')[0].addEventListener('click', onPersonaClickCapture, true);
    }

    function removePersonaDragListeners() {
        clearPersonaDrag();
        const list = $pmList[0];
        list.removeEventListener('mousedown', onPersonaMouseDown);
        document.removeEventListener('mousemove', onPersonaMouseMove);
        document.removeEventListener('mouseup', onPersonaMouseUp);
        list.removeEventListener('touchstart', onPersonaTouchStart);
        list.removeEventListener('touchmove', onPersonaTouchMove);
        list.removeEventListener('touchend', onPersonaTouchEnd);
        list.removeEventListener('touchcancel', clearPersonaDrag);
        list.removeEventListener('contextmenu', onPersonaContextMenu);
        list.removeEventListener('click', onPersonaClickCapture, true);
        $overlay.find('#pm_drop_targets')[0].removeEventListener('click', onPersonaClickCapture, true);
    }

    renderList();
    addPersonaDragListeners();
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
                <span class="folder-name">${escapeHtml(name)}</span>
                <button class="delete-btn" data-name="${escapeHtml(name)}"><i class="fa-solid fa-trash-can"></i>삭제</button>
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
        $('#export_all_settings_btn').click(onExportAllSettings);
        $('#import_settings_btn').click(onImportSettings);

        renderHiddenFolderList();
    } catch (e) {
        console.error(`[${extensionName}] Init Error:`, e);
    }

    injectCssRules(); 
    injectJumpButton(); 
    addTocButton();
    connectObserver();
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, scheduleCharacterListUpdate);
    themeManager.init(settings.theme);
	
    // 다음 업데이트 때: CURRENT_NOTICE_ID를 v2로 바꾸고, CURRENT_NOTICE_HTML에 새 내용을 적기만 하면 됩니다.
    const CURRENT_NOTICE_ID = 'patch_2026_10_mobile_v1';

    // 이번 공지사항의 내용 (HTML 태그 사용 가능)
    const CURRENT_NOTICE_HTML = `
        <p>
            모바일 관리창의 화면 잘림을 수정했습니다.<br>
            캐릭터·페르소나 관리창이 현재 보이는 화면에 맞춰지고,
            키보드가 뜨거나 가로로 회전해도 제목과 하단 버튼을 사용할 수 있습니다.
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
