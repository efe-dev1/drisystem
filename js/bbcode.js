const BBCodeEditor = {
    tags: {
        'b': { open: '[b]', close: '[/b]', icon: 'ph ph-bold', title: 'Negrito' },
        'i': { open: '[i]', close: '[/i]', icon: 'ph ph-italic', title: 'Itálico' },
        'u': { open: '[u]', close: '[/u]', icon: 'ph ph-underline', title: 'Sublinhado' },
        's': { open: '[s]', close: '[/s]', icon: 'ph ph-strikethrough', title: 'Riscado' },
        'center': { open: '[center]', close: '[/center]', icon: 'ph ph-text-align-center', title: 'Centralizar' },
        'left': { open: '[left]', close: '[/left]', icon: 'ph ph-text-align-left', title: 'Esquerda' },
        'right': { open: '[right]', close: '[/right]', icon: 'ph ph-text-align-right', title: 'Direita' },
        'justify': { open: '[justify]', close: '[/justify]', icon: 'ph ph-text-align-justify', title: 'Justificar' },
        'color': { open: '[color=#FFFFFF]', close: '[/color]', icon: 'ph ph-palette', title: 'Cor' },
        'size': { open: '[size=15]', close: '[/size]', icon: 'ph ph-text-aa', title: 'Tamanho' },
        'url': { open: '[url]', close: '[/url]', icon: 'ph ph-link', title: 'Link' },
        'img': { open: '[img]', close: '[/img]', icon: 'ph ph-image', title: 'Imagem' },
        'quote': { open: '[quote]', close: '[/quote]', icon: 'ph ph-quotes', title: 'Citação' },
        'code': { open: '[code]', close: '[/code]', icon: 'ph ph-code', title: 'Código' },
        'list': { open: '[list]', close: '[/list]', icon: 'ph ph-list-bullets', title: 'Lista' },
        '*': { open: '[*]', close: '', icon: 'ph ph-dot', title: 'Item de lista' }
    },

    insertTag(textarea, openTag, closeTag) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const newText = textarea.value.substring(0, start) + openTag + selectedText + closeTag + textarea.value.substring(end);
        textarea.value = newText;
        textarea.focus();
        textarea.setSelectionRange(start + openTag.length, end + openTag.length);
        textarea.dispatchEvent(new Event('input'));
    },

    showColorPicker(textarea) {
        const colorPicker = document.createElement('div');
        colorPicker.className = 'bbcode-color-picker';
        colorPicker.innerHTML = `
            <div class="color-picker-popup">
                <div class="color-grid">
                    ${['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000', '#000000'].map(c => 
                        `<div class="color-option" style="background:${c}" onclick="BBCodeEditor.applyColor('${c}')"></div>`
                    ).join('')}
                </div>
                <input type="text" id="customColor" placeholder="#RRGGBB" class="custom-color-input">
                <button onclick="BBCodeEditor.applyColor(document.getElementById('customColor').value)" class="apply-color-btn">Aplicar</button>
            </div>
        `;
        
        const rect = textarea.getBoundingClientRect();
        colorPicker.style.position = 'absolute';
        colorPicker.style.top = `${rect.top - 150}px`;
        colorPicker.style.left = `${rect.left}px`;
        colorPicker.style.zIndex = '1000';
        
        document.body.appendChild(colorPicker);
        
        const closePicker = (e) => {
            if (!colorPicker.contains(e.target)) {
                colorPicker.remove();
                document.removeEventListener('click', closePicker);
            }
        };
        setTimeout(() => document.addEventListener('click', closePicker), 100);
    },

    applyColor(color) {
        const textarea = document.getElementById('novoDocumentoConteudo');
        if (!textarea) return;
        const openTag = `[color=${color}]`;
        const closeTag = '[/color]';
        this.insertTag(textarea, openTag, closeTag);
        const picker = document.querySelector('.bbcode-color-picker');
        if (picker) picker.remove();
    },

    showSizePicker(textarea) {
        const size = prompt('Digite o tamanho da fonte (8-32):', '15');
        if (size && size >= 8 && size <= 32) {
            this.insertTag(textarea, `[size=${size}]`, '[/size]');
        } else if (size) {
            alert('Tamanho inválido. Use valores entre 8 e 32.');
        }
    },

    showUrlPrompt(textarea) {
        const url = prompt('Digite a URL:', 'https://');
        if (url) {
            const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
            if (selectedText) {
                this.insertTag(textarea, `[url=${url}]`, '[/url]');
            } else {
                this.insertTag(textarea, `[url]${url}[/url]`, '');
            }
        }
    },

    showImagePrompt(textarea) {
        const url = prompt('Digite a URL da imagem:', 'https://');
        if (url) {
            this.insertTag(textarea, `[img]${url}[/img]`, '');
        }
    },

    createToolbar(textareaId) {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;
        
        const toolbar = document.createElement('div');
        toolbar.className = 'bbcode-toolbar';
        
        const buttons = [
            { tag: 'b' }, { tag: 'i' }, { tag: 'u' }, { tag: 's' },
            { divider: true },
            { tag: 'left' }, { tag: 'center' }, { tag: 'right' }, { tag: 'justify' },
            { divider: true },
            { tag: 'color', custom: 'showColorPicker' },
            { tag: 'size', custom: 'showSizePicker' },
            { tag: 'url', custom: 'showUrlPrompt' },
            { tag: 'img', custom: 'showImagePrompt' },
            { divider: true },
            { tag: 'quote' }, { tag: 'code' },
            { divider: true },
            { tag: 'list' }, { tag: '*' }
        ];
        
        buttons.forEach(btn => {
            if (btn.divider) {
                const divider = document.createElement('span');
                divider.className = 'bbcode-divider';
                toolbar.appendChild(divider);
            } else {
                const tag = this.tags[btn.tag];
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'bbcode-btn';
                button.innerHTML = `<i class="${tag.icon}"></i>`;
                button.title = tag.title;
                
                if (btn.custom) {
                    button.onclick = () => this[btn.custom](textarea);
                } else {
                    button.onclick = () => this.insertTag(textarea, tag.open, tag.close);
                }
                
                toolbar.appendChild(button);
            }
        });
        
        textarea.parentNode.insertBefore(toolbar, textarea);
    },

    parseBBCode(text) {
        if (!text) return '';
        
        let html = text;

        html = html.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
        
        const rules = [
            { regex: /\[b\](.*?)\[\/b\]/gi, replacement: '<strong>$1</strong>' },
            { regex: /\[i\](.*?)\[\/i\]/gi, replacement: '<em>$1</em>' },
            { regex: /\[u\](.*?)\[\/u\]/gi, replacement: '<u>$1</u>' },
            { regex: /\[s\](.*?)\[\/s\]/gi, replacement: '<del>$1</del>' },
            { regex: /\[center\](.*?)\[\/center\]/gi, replacement: '<div style="text-align:center">$1</div>' },
            { regex: /\[left\](.*?)\[\/left\]/gi, replacement: '<div style="text-align:left">$1</div>' },
            { regex: /\[right\](.*?)\[\/right\]/gi, replacement: '<div style="text-align:right">$1</div>' },
            { regex: /\[justify\](.*?)\[\/justify\]/gi, replacement: '<div style="text-align:justify">$1</div>' },
            { regex: /\[color=(#[A-Fa-f0-9]{6}|#[A-Fa-f0-9]{3}|[a-z]+)\](.*?)\[\/color\]/gi, replacement: '<span style="color:$1">$2</span>' },
            { regex: /\[size=(\d+)\](.*?)\[\/size\]/gi, replacement: '<span style="font-size:$1px">$2</span>' },
            { regex: /\[url\](.*?)\[\/url\]/gi, replacement: '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>' },
            { regex: /\[url=(.*?)\](.*?)\[\/url\]/gi, replacement: '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>' },
            { regex: /\[img\](.*?)\[\/img\]/gi, replacement: '<img src="$1" alt="Imagem" style="max-width:100%; border-radius:8px; margin:8px 0;">' },
            { regex: /\[quote\](.*?)\[\/quote\]/gi, replacement: '<div class="bbcode-quote"><div class="quote-header">Citação:</div><div class="quote-content">$1</div></div>' },
            { regex: /\[code\](.*?)\[\/code\]/gi, replacement: '<pre class="bbcode-code"><code>$1</code></pre>' },
            { regex: /\[list\](.*?)\[\/list\]/gi, replacement: '<ul class="bbcode-list">$1</ul>' },
            { regex: /\[\*\](.*?)(?=\n|$)/gi, replacement: '<li>$1</li>' }
        ];
        
        rules.forEach(rule => {
            html = html.replace(rule.regex, rule.replacement);
        });
        
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
};

window.BBCodeEditor = BBCodeEditor;