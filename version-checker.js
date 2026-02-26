const VersionChecker = {
    version: null,
    timer: null,
    showing: false,

    async getVersion() {
        try {
            const response = await fetch('version.txt?v=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            
            if (!response.ok) return null;
            
            const text = await response.text();
            return text.trim();
        } catch (e) {
            return null;
        }
    },

    createToast() {
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
            cursor: pointer;
            border: 2px solid rgba(255,255,255,0.2);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        toast.innerHTML = `
            <strong style="display: block; margin-bottom: 4px;">Nova versão disponível</strong>
            <span style="font-size: 0.85rem; opacity: 0.9;">Clique para recarregar</span>
        `;

        toast.onclick = () => window.location.reload(true);
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (document.getElementById('version-toast')) {
                document.getElementById('version-toast').remove();
                this.showing = false;
            }
        }, 5000);
    },

    async check() {
        const newVersion = await this.getVersion();
        
        if (!newVersion) return;
        
        if (!this.version) {
            this.version = newVersion;
            return;
        }
        
        if (this.version !== newVersion && !this.showing) {
            this.showing = true;
            this.version = newVersion;
            this.createToast();
        }
    },

    start() {
        setTimeout(() => this.check(), 2000);
        this.timer = setInterval(() => this.check(), 10000);
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
};

window.VersionChecker = VersionChecker;

document.addEventListener('DOMContentLoaded', () => {
    VersionChecker.start();
});

window.addEventListener('beforeunload', () => {
    VersionChecker.stop();
});