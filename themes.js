import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js'; 

const extensionName = 'FolderHider';


const THEMES = {
    'lavender': {
        name: '라벤더 (기본)',
        colors: {
            '--fh-accent': '#9a86d3',       
            '--fh-secondary': '#e6e1f5',    
            '--fh-border': '#d8d1eb',       
            '--fh-bg': '#f8f6fb',           
            '--fh-text': '#3a2e5f',         
            '--fh-btn-bg': '#bfaee3',
            '--fh-btn-grad-1': '#d9cff5',
            '--fh-btn-grad-2': '#b7a4e0',
            '--fh-btn-text': '#3a2e5f',     
            '--fh-hover-bg': 'rgba(154, 134, 211, 0.1)',
            '--fh-selected-bg': 'rgba(154, 134, 211, 0.25)' 
        },
        preview: '#bfaee3'
    },
    'white_marble': {
        name: '화이트 마블',
        colors: {
            '--fh-accent': '#607d8b',       
            '--fh-secondary': '#f0f2f5',    
            '--fh-border': '#dce0e3',       
            '--fh-bg': '#ffffff',           
            '--fh-text': '#2c3e50',         
            '--fh-btn-bg': '#eaeff2',
            '--fh-btn-grad-1': '#f7f9fa',
            '--fh-btn-grad-2': '#dce3e6',
            '--fh-btn-text': '#37474f',
            '--fh-hover-bg': 'rgba(0,0,0,0.04)',
            '--fh-selected-bg': 'rgba(96, 125, 139, 0.15)' 
        },
        preview: '#eceff1'
    },
    'dark': {
        name: '다크 모드',
        colors: {
            '--fh-accent': '#a29bfe',       
            '--fh-secondary': '#383838',    
            '--fh-border': '#555555',       
            '--fh-bg': '#212121',           
            '--fh-text': '#ececec',         
            '--fh-btn-bg': '#424242',
            '--fh-btn-grad-1': '#555555',
            '--fh-btn-grad-2': '#3a3a3a',
            '--fh-btn-text': '#ffffff',     
            '--fh-hover-bg': '#333333',     
            '--fh-selected-bg': '#464646'   
        },
        preview: '#2d2d2d'
    },
    'mocha': {
        name: '모카 브라운',
        colors: {
            '--fh-accent': '#8d6e63',       
            '--fh-secondary': '#efebe9',    
            '--fh-border': '#d7ccc8',       
            '--fh-bg': '#fbf8f6',           
            '--fh-text': '#4e342e',         
            '--fh-btn-bg': '#d7ccc8',
            '--fh-btn-grad-1': '#efebe9',   
            '--fh-btn-grad-2': '#d7ccc8',   
            '--fh-btn-text': '#3e2723',     
            '--fh-hover-bg': 'rgba(121, 85, 72, 0.12)',
            '--fh-selected-bg': 'rgba(141, 110, 99, 0.25)' 
        },
        preview: '#8d6e63'
    }
};

export const themeManager = {
    
    applyTheme: (themeKey) => {
        const theme = THEMES[themeKey] || THEMES['lavender'];
        const rootId = 'folder-hider-theme-vars';
        
        
        let cssString = `:root {`;
        for (const [key, value] of Object.entries(theme.colors)) {
            cssString += `${key}: ${value} !important;`;
        }
        cssString += `}`;

        
        let $style = $(`#${rootId}`);
        if ($style.length === 0) {
            $style = $(`<style id="${rootId}">`);
            $('head').append($style);
        }
        $style.text(cssString);

        
        if (extension_settings[extensionName]) {
            extension_settings[extensionName].theme = themeKey;
            saveSettingsDebounced();
        }
    },

    
    getPaletteHTML: (currentTheme) => {
        let html = `<div class="fh-theme-palette-container">`;
        html += `<label style="display:block; margin-bottom:8px; font-weight:600; color:var(--fh-text);">🎨 UI 테마 선택</label>`;
        html += `<div class="fh-palette-row">`;
        
        for (const [key, theme] of Object.entries(THEMES)) {
            const isActive = (key === currentTheme) ? 'active' : '';
            
            let previewColor = theme.preview;
            
            let checkColor = '#fff';
            if (key === 'white_marble' || key === 'lavender') checkColor = '#333';
            if (key === 'white_marble') previewColor = '#f5f5f5'; 

            html += `
                <div class="fh-palette-item ${isActive}" 
                     data-theme="${key}" 
                     title="${theme.name}"
                     style="background-color: ${previewColor};">
                   ${isActive ? `<i class="fa-solid fa-check" style="color:${checkColor}; font-size:0.8em;"></i>` : ''}
                </div>
            `;
        }
        html += `</div></div>`;
        return html;
    },

    
    bindPaletteEvents: () => {
        $('.fh-palette-item').off('click').on('click', function() {
            const selectedTheme = $(this).data('theme');
            
            
            $('.fh-palette-item').removeClass('active').empty();
            
            
            let checkColor = '#fff';
            if (selectedTheme === 'white_marble' || selectedTheme === 'lavender') checkColor = '#333';
            
            $(this).addClass('active').html(`<i class="fa-solid fa-check" style="color:${checkColor}; font-size:0.8em;"></i>`);
            
            
            themeManager.applyTheme(selectedTheme);
        });
    },
    
    
    init: (savedTheme) => {
        themeManager.applyTheme(savedTheme || 'lavender');
    }
};