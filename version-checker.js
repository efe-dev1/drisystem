const VersionChecker = {
    currentVersion: null,
    checkInterval: null,
    toastShown: false,
    toastElement: null,
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
        if (this.toastElement) return;
        
        const toast = document.createElement('div');
        toast.id = 'version-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00a884;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.2);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        toast.innerHTML = `
            <div>
                <strong style="display: block; margin-bottom: 4px;">Nova versão disponível</strong>
                <span style="font-size: 0.85rem; opacity: 0.9;">Clique para recarregar</span>
            </div>
        `;

        toast.addEventListener('click', () => {
            window.location.reload(true);
        });
        
        this.toastElement = toast;

        const style = document.createElement('style');
        style.id = 'version-toast-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            #version-toast { animation: slideIn 0.3s ease; }
            #version-toast.hiding { animation: slideOut 0.3s ease; }
            #version-toast:hover { background: #008f72; }
        `;
        document.head.appendChild(style);
    },

    showUpdateToast() {
        if (this.toastShown) return;
        
        this.toastShown = true;
        this.createToastElement();
        
        document.body.appendChild(this.toastElement);
        this.toastElement.classList.remove('hiding');
        
        setTimeout(() => {
            if (this.toastElement && this.toastElement.parentNode) {
                this.toastElement.classList.add('hiding');
                setTimeout(() => {
                    if (this.toastElement && this.toastElement.parentNode) {
                        this.toastElement.remove();
                    }
                }, 300);
            }
            this.toastShown = false;
        }, 5000);
    },

    async init() {
        await this.checkForUpdates();
        
        this.checkInterval = setInterval(async () => {
            if (await this.checkForUpdates()) {
                this.showUpdateToast();
            }
        }, 8000);

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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    VersionChecker.init();
});

window.addEventListener('beforeunload', () => {
    VersionChecker.stopChecking();
});

window.VersionChecker = VersionChecker;