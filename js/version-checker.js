const VersionChecker = {
  currentVersion: null,
  checkInterval: null,
  toastShown: false,
  filesToCheck: [
    'index.html',
    'home.html',
    'listagem.html',
    'admin.html',
    'criar_conta.html',
    'redefinir_senha.html',
    'documentacoes.html',
    'memorial.html',
    'reportar.html',
    'req_membros.html',
    'registro_funcao.html',
    'registros.html',
    'escala_fiscalizador.html',
    'escala_superintendente.html',
    'meu_perfil.html',
    'js/auth.js',
    'js/session.js',
    'js/supabase.js',
    'js/utils.js',
    'js/chat.js',
    'js/version-checker.js'
  ],

  getStoredVersion() {
    return sessionStorage.getItem('dri_version_hash');
  },

  setStoredVersion(hash) {
    sessionStorage.setItem('dri_version_hash', hash);
  },

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
      console.error('Erro ao gerar master hash:', error);
      return Date.now().toString();
    }
  },

  async checkForUpdates() {
    try {
      const masterHash = await this.generateMasterHash();
      const storedHash = this.getStoredVersion();

      if (!storedHash) {
        this.setStoredVersion(masterHash);
        this.currentVersion = masterHash;
        return false;
      }

      const hasChanged = storedHash !== masterHash;
      
      if (hasChanged) {
        this.setStoredVersion(masterHash);
        this.currentVersion = masterHash;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      return false;
    }
  },

  showUpdateToast() {
    if (this.toastShown) return;
    
    this.toastShown = true;
    
    const toast = document.createElement('div');
    toast.className = 'toast update-toast';
    toast.id = 'update-toast';
    toast.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <strong style="font-size: 14px; color: #f2f2f2;">Nova atualização disponível!</strong>
        <span style="font-size: 12px; color: #b5b5b5;">Recarregue a página.</span>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .update-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        color: white;
        min-width: 280px;
        background: rgb(40, 40, 40);
        border: 2px solid #161616;
        border-radius: 8px;
        padding: 16px 20px;
        z-index: 999999;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: 'Poppins', sans-serif;
      }
      .update-toast strong {
        color: white;
      }
      .update-toast span {
        color: #afafaf;
      }
      .update-toast:hover {
        border-color: white;
      }
    `;
    document.head.appendChild(style);

    toast.addEventListener('click', () => {
      window.location.reload(true);
    });
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.getElementById('update-toast')) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
          this.toastShown = false;
        }, 200);
      }
    }, 5000);
  },

  refreshPage() {
    window.location.reload(true);
  },

  startChecking(interval = 8000) {
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
      } catch (error) {
        console.error('Erro no version checker:', error);
      }
    }, interval);
  },

  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
    VersionChecker.startChecking(8000);
});

window.addEventListener('beforeunload', () => {
  VersionChecker.stopChecking();
});

window.VersionChecker = VersionChecker;