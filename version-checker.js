const VersionChecker = {
    currentHash: null,
    interval: null,
    toast: null,
    shown: false,

    async generateHash() {
        try {
            const files = [
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
            ];

            const hashes = [];

            for (const file of files) {
                const res = await fetch(`${file}?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) continue;
                
                const text = await res.text();
                const encoder = new TextEncoder();
                const data = encoder.encode(text);
                const hash = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hash));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
                hashes.push(`${file}:${hashHex}`);
            }

            const combined = hashes.sort().join('|');
            const encoder = new TextEncoder();
            const data = encoder.encode(combined);
            const hash = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hash));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        } catch {
            return Date.now().toString();
        }
    },

    createToast() {
        if (this.toast) return;

        const div = document.createElement('div');
        div.id = 'version-toast';
        div.style.cssText = `
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
        `;

        div.innerHTML = `
            <div>
                <strong style="display: block; margin-bottom: 4px;">Nova versão disponível</strong>
                <span style="font-size: 0.85rem; opacity: 0.9;">Clique para recarregar</span>
            </div>
        `;

        div.onclick = () => window.location.reload(true);
        this.toast = div;

        const style = document.createElement('style');
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
            #version-toast.hide { animation: slideOut 0.3s ease; }
            #version-toast:hover { background: #008f72; }
        `;
        document.head.appendChild(style);

        document.body.appendChild(div);
    },

    showToast() {
        if (this.shown) return;
        this.shown = true;

        this.createToast();
        this.toast.classList.remove('hide');

        setTimeout(() => {
            if (this.toast) {
                this.toast.classList.add('hide');
                setTimeout(() => {
                    if (this.toast && this.toast.classList.contains('hide')) {
                        this.toast.remove();
                        this.toast = null;
                        this.shown = false;
                    }
                }, 300);
            }
        }, 5000);
    },

    async check() {
        const hash = await this.generateHash();

        if (!this.currentHash) {
            this.currentHash = hash;
            return false;
        }

        if (this.currentHash !== hash) {
            this.currentHash = hash;
            return true;
        }

        return false;
    },

    async init() {
        const hash = await this.generateHash();
        this.currentHash = hash;

        this.interval = setInterval(async () => {
            if (await this.check()) {
                this.showToast();
            }
        }, 30000);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.check();
        });

        window.addEventListener('pageshow', (e) => {
            if (e.persisted) this.check();
        });
    },

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => VersionChecker.init(), 1500);
});

window.addEventListener('beforeunload', () => VersionChecker.stop());

window.VersionChecker = VersionChecker;