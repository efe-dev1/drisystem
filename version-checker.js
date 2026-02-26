const VersionChecker = {
    version: null,
    showing: false,

    async check() {
        try {
            const res = await fetch('version.txt?v=' + Date.now(), {
                cache: 'no-store'
            });
            
            if (!res.ok) return;
            
            const v = await res.text();
            
            if (!this.version) {
                this.version = v;
                return;
            }
            
            if (this.version !== v && !this.showing) {
                this.showing = true;
                this.version = v;
                
                const toast = document.createElement('div');
                toast.id = 'vc-toast';
                toast.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #00a884;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 999999;
                    font-family: 'Poppins', sans-serif;
                    font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                toast.innerHTML = 'Nova versão disponível<br><small>Clique para recarregar</small>';
                toast.onclick = () => window.location.reload(true);
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    if (document.getElementById('vc-toast')) {
                        document.getElementById('vc-toast').remove();
                        this.showing = false;
                    }
                }, 5000);
            }
        } catch (e) {}
    },

    start() {
        this.check();
        setInterval(() => this.check(), 10000);
    }
};

window.VersionChecker = VersionChecker;
document.addEventListener('DOMContentLoaded', () => VersionChecker.start());