const VersionChecker = {
    files: [
        'js/auth.js',
        'js/chat.js',
        'js/session.js',
        'js/utils.js',
        'js/supabase.js',
        'js/chat.css',
        'index.html',
        'home.html',
        'admin.html',
        'criar_conta.html',
        'redefinir_senha.html',
        'documentacoes.html',
        'escala_fiscalizador.html',
        'escala_superintendente.html',
        'listagem.html',
        'memorial.html',
        'meu_perfil.html',
        'registro_funcao.html',
        'registros.html',
        'reportar.html',
        'req_membros.html'
    ],
    
    fileHashes: {},
    checkInterval: null,
    toastElement: null,
    lastCheck: 0,
    toastTimeout: null,

    async init() {
        console.log('Version iniciado...');
        
        this.loadSavedHashes();

        this.createToastElement();
        
        await this.checkAllFiles();

        this.checkInterval = setInterval(() => this.checkAllFiles(), 30000);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkAllFiles();
            }
        });

        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this.checkAllFiles();
            }
        });
    },

    createToastElement() {
        if (document.getElementById('version-toast')) return;
        
        const toast = document.createElement('div');
        toast.id = 'version-toast';
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #00a884;
            color: white;
            padding: 11px 18px;
            border-radius: 8px;
            z-index: 10001;
            display: none;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            align-items: center;
            gap: 12px;
            animation: toastIn 0.3s ease;
            border: 2px solid rgba(255,255,255,0.2);
            max-width: 350px;
            pointer-events: none;
        `;
        
        toast.innerHTML = `
            <i class="ph ph-arrow-clockwise" style="font-size: 1.4rem;"></i>
            <div style="flex: 1;">
                <strong style="font-size: 1rem; display: block; margin-bottom: 3px;">Nova versão disponível!</strong>
                <span style="font-size: 0.85rem; opacity: 0.9;">Recarregue a página</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        this.toastElement = toast;

        if (!document.getElementById('version-checker-styles')) {
            const style = document.createElement('style');
            style.id = 'version-checker-styles';
            style.textContent = `
                @keyframes toastIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes toastOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },

    loadSavedHashes() {
        try {
            const saved = localStorage.getItem('file_hashes');
            if (saved) {
                this.fileHashes = JSON.parse(saved);
                console.log('Hashes carregados:', Object.keys(this.fileHashes).length, 'arquivos');
            }
        } catch (error) {
            console.log('Erro ao carregar hashes:', error);
            this.fileHashes = {};
        }
    },

    saveHashes() {
        try {
            localStorage.setItem('file_hashes', JSON.stringify(this.fileHashes));
        } catch (error) {
            console.log('Erro ao salvar hashes:', error);
        }
    },

    async getFileHash(url) {
        try {
            const response = await fetch(`${url}?t=${Date.now()}`, {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (!response.ok) return null;

            const lastModified = response.headers.get('last-modified');
            const etag = response.headers.get('etag');
            const contentLength = response.headers.get('content-length');
            
            if (lastModified || etag || contentLength) {
                const hashInput = `${lastModified || ''}|${etag || ''}|${contentLength || ''}`;
                return this.simpleHash(hashInput);
            }

            const fullResponse = await fetch(`${url}?t=${Date.now()}`);
            const text = await fullResponse.text();
            return this.simpleHash(text.substring(0, 1000));
            
        } catch (error) {
            return null;
        }
    },

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    },

    async checkAllFiles() {
        const now = Date.now();
        if (now - this.lastCheck < 5000) return;
        this.lastCheck = now;

        let hasChanges = false;

        for (const file of this.files) {
            const currentHash = await this.getFileHash(file);
            
            if (currentHash) {
                const savedHash = this.fileHashes[file];
                
                if (!savedHash) {
                    this.fileHashes[file] = currentHash;
                }
                else if (savedHash !== currentHash) {
                    console.log(`Arquivo alterado: ${file}`);
                    hasChanges = true;
                    this.fileHashes[file] = currentHash;
                }
            }
        }

        if (hasChanges) {
            this.saveHashes();
            this.showToast();
        }
    },

    showToast() {
        if (!this.toastElement) return;

        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }

        this.toastElement.style.display = 'flex';
        this.toastElement.style.animation = 'toastIn 0.3s ease';
        
        this.toastTimeout = setTimeout(() => {
            if (this.toastElement) {
                this.toastElement.style.animation = 'toastOut 0.3s ease';
                setTimeout(() => {
                    if (this.toastElement) {
                        this.toastElement.style.display = 'none';
                    }
                }, 300);
            }
        }, 5000);
    },

    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    },

    async forceCheck() {
        await this.checkAllFiles();
    },

    resetHashes() {
        this.fileHashes = {};
        localStorage.removeItem('file_hashes');
        console.log('🔄 Hashes resetados');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        VersionChecker.init();
    }, 1500);
});

window.VersionChecker = VersionChecker;