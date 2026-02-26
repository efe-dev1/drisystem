const VersionChecker = {
    currentVersion: null,
    checkInterval: null,
    toastShown: false,
    filesToCheck: [
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

    async generateFileHash(url) {
        try {
            const response = await fetch(`${url}?t=${Date.now()}`, {
                cache: 'no-store',
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) return null;
            
            const content = await response.text();
            const encoder = new TextEncoder();
            const data = encoder.encode(content);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        } catch (error) {
            return null;
        }
    },

    async generateMasterHash() {
        try {
            const hashes = [];
            
            for (const file of this.filesToCheck) {
                const hash = await this.generateFileHash(file);
                if (hash) {
                    hashes.push(`${file}:${hash}`);
                }
            }
            
            const combined = hashes.sort().join('|');
            const encoder = new TextEncoder();
            const data = encoder.encode(combined);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
        } catch (error) {
            return Date.now().toString();
        }
    },

    async checkForUpdates() {
        try {
            const masterHash = await this.generateMasterHash();

            if (!this.currentVersion) {
                this.currentVersion = masterHash;
                return false;
            }

            const hasChanged = this.currentVersion !== masterHash;
            
            if (hasChanged) {
                this.currentVersion = masterHash;
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    },

    createToastElement() {
        if (document.getElementById('version-toast')) return;
        
        const toast = document.createElement('div');
        toast.id = 'version-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00a884;
            color: white;
            padding: 11px 16px;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: slideIn 0.3s ease;
            border: 2px solid rgba(255,255,255,0.2);
            max-width: 350px;
            cursor: pointer;
        `;
        
        toast.innerHTML = `
            <div style="flex: 1;">
                <strong style="font-size: 1rem; display: block; margin-bottom: 3px;">Nova versão disponível!</strong>
                <span style="font-size: 0.85rem; opacity: 0.9;">Clique para recarregar</span>
            </div>
        `;

        toast.addEventListener('click', () => {
            window.location.reload(true);
        });
        
        document.body.appendChild(toast);
        this.toastElement = toast;

        if (!document.getElementById('version-checker-styles')) {
            const style = document.createElement('style');
            style.id = 'version-checker-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                #version-toast:hover {
                    background: #008f72;
                }
            `;
            document.head.appendChild(style);
        }
    },

    showUpdateToast() {
        if (this.toastShown) return;
        
        this.toastShown = true;
        
        if (!this.toastElement) {
            this.createToastElement();
        }
        
        this.toastElement.style.display = 'flex';
        this.toastElement.style.animation = 'slideIn 0.3s ease';
        
        setTimeout(() => {
            if (this.toastElement) {
                this.toastElement.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (this.toastElement) {
                        this.toastElement.style.display = 'none';
                        this.toastShown = false;
                    }
                }, 300);
            }
        }, 5000);
    },

    async init() {
        console.log('Version iniciado...');
        
        this.createToastElement();
        
        setTimeout(async () => {
            if (await this.checkForUpdates()) {
                this.showUpdateToast();
            }
        }, 2000);

        this.checkInterval = setInterval(async () => {
            try {
                if (await this.checkForUpdates()) {
                    this.showUpdateToast();
                }
            } catch (error) {}
        }, 30000);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        });

        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this.checkForUpdates();
            }
        });
    },

    stopChecking() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    },

    async forceCheck() {
        if (await this.checkForUpdates()) {
            this.showUpdateToast();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        VersionChecker.init();
    }, 1500);
});

window.addEventListener('beforeunload', () => {
    VersionChecker.stopChecking();
});

window.VersionChecker = VersionChecker;