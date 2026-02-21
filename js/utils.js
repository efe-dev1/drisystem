const Utils = {
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    async comparePassword(password, hashedPassword) {
        const hash = await this.hashPassword(password);
        return hash === hashedPassword;
    },

    getBrasiliaTime() {
        const data = new Date();
        const offsetBrasilia = -3;
        const utc = data.getTime() + (data.getTimezoneOffset() * 60000);
        return new Date(utc + (3600000 * offsetBrasilia));
    },

    gerarCodigo() {
        const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const letra = letras[Math.floor(Math.random() * letras.length)];
        const numeros = Math.floor(100 + Math.random() * 900);
        return `${letra}-${numeros}`;
    },

    async verificarMottoHabbo(nick, codigo) {
        try {
            const response = await fetch(`https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`);
            if (!response.ok) return false;
            
            const habboUser = await response.json();
            const motto = habboUser.motto || '';
            
            console.log(`Verificando missão de ${nick}: "${motto}" | Procurando: "${codigo}"`);
            
            return motto.includes(codigo);
        } catch (error) {
            console.error('Erro ao buscar usuário do Habbo:', error);
            return false;
        }
    }
};

window.Utils = Utils;