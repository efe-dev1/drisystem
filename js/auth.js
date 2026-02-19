const Auth = {
    async criarConta(nick, senha) {
        try {
            const { data: existente } = await window.supabase
                .from('usuarios')
                .select('nick')
                .eq('nick', nick)
                .maybeSingle();
            
            if (existente) {
                return { success: false, message: 'Nick já existe' };
            }

            const codigo = this.gerarCodigo();
            
            console.log(`Código gerado para ${nick}: ${codigo}`);

            const cargo = nick.toLowerCase() === 'youiz' ? 'DEV' : 'Fiscalizador';

            const agoraBrasilia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

            const { error } = await window.supabase
                .from('usuarios')
                .insert([{
                    nick: nick,
                    senha: senha,
                    cargo: cargo,
                    verificado: false,
                    data_criacao: agoraBrasilia,
                    status: 'ATIVO'
                }]);

            if (error) throw error;

            await window.supabase
                .from('codigos_verificacao')
                .insert([{
                    usuario_nick: nick,
                    codigo: codigo,
                    tipo: 'CRIACAO',
                    expira_em: new Date(agoraBrasilia.getTime() + 5 * 60 * 1000)
                }]);

            return { 
                success: true, 
                codigo,
                nick,
                message: 'Conta criada! Verificando missão do Habbo...' 
            };

        } catch (error) {
            console.error('Erro ao criar conta:', error);
            return { success: false, message: 'Erro ao criar conta: ' + error.message };
        }
    },

    async fetchHabboUser(nick) {
        try {
            const response = await fetch(`https://www.habbo.com.br/api/public/users?name=${encodeURIComponent(nick)}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar usuário do Habbo:', error);
            return null;
        }
    },

    async verifyMotto(nick, code) {
        try {
            const habboUser = await this.fetchHabboUser(nick);
            if (!habboUser) return false;
            
            const motto = habboUser.motto || '';
            console.log(`Missão de ${nick}: "${motto}"`);
            console.log(`Procurando: "${code}"`);
            
            return motto.includes(code);
        } catch (error) {
            console.error('Erro na verificação:', error);
            return false;
        }
    },

    async verificarEAtivar(nick, codigo) {
        try {
            const { data: codigoData } = await window.supabase
                .from('codigos_verificacao')
                .select('*')
                .eq('usuario_nick', nick)
                .eq('codigo', codigo)
                .eq('usado', false)
                .gt('expira_em', new Date().toISOString())
                .maybeSingle();

            if (!codigoData) {
                return { success: false, message: 'Código inválido ou expirado' };
            }

            const encontrado = await this.verifyMotto(nick, codigo);
            
            if (!encontrado) {
                return { success: false, message: 'Código não encontrado na missão' };
            }

            await window.supabase
                .from('codigos_verificacao')
                .update({ usado: true })
                .eq('id', codigoData.id);

            await window.supabase
                .from('usuarios')
                .update({ verificado: true })
                .eq('nick', nick);

            return { success: true, message: 'Conta verificada com sucesso!' };

        } catch (error) {
            console.error('Erro na verificação:', error);
            return { success: false, message: 'Erro ao verificar conta' };
        }
    },

    async login(nick, senha, manterConectado = true) {
        try {
            if (window.SessionManager) {
                const existingSession = await SessionManager.validateDeviceForLogin(nick);
                if (existingSession) {
                    return { success: true, fromSavedSession: true };
                }
            }

            const { data: usuario } = await window.supabase
                .from('usuarios')
                .select('*')
                .eq('nick', nick)
                .eq('senha', senha)
                .eq('verificado', true)
                .maybeSingle();

            if (!usuario) {
                return { success: false, message: 'Nick ou senha inválidos' };
            }

            if (usuario.status !== 'ATIVO') {
                let mensagem = 'Usuário não está ativo';
                if (usuario.status === 'BLOQUEADO') mensagem = 'Usuário bloqueado';
                if (usuario.status === 'LICENCA') mensagem = 'Usuário em licença';
                if (usuario.status === 'RESERVA') mensagem = 'Usuário na reserva';
                return { success: false, message: mensagem };
            }

            if (window.SessionManager) {
                await SessionManager.createSession(nick, usuario.cargo, manterConectado);
            } else {
                const token = this.gerarToken();
                const agoraBrasilia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
                const expiracao = new Date(agoraBrasilia.getTime() + (manterConectado ? 5 : 1) * 24 * 60 * 60 * 1000);

                const sessao = {
                    nick,
                    token,
                    cargo: usuario.cargo,
                    expiracao: expiracao.toISOString(),
                    manterConectado
                };

                sessionStorage.setItem('dri_session', JSON.stringify(sessao));
                sessionStorage.setItem('dri_user', nick);

                if (manterConectado) {
                    localStorage.setItem('dri_session', JSON.stringify(sessao));
                    localStorage.setItem('dri_user', nick);
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro no login' };
        }
    },

    async logout() {
        if (window.SessionManager) {
            await SessionManager.logout();
        } else {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'index.html';
        }
    },

    async redirectIfNotAuthenticated() {
        const autenticado = await this.isAuthenticated();
        if (!autenticado) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    async isAuthenticated() {
        if (window.SessionManager) {
            const sessao = await SessionManager.validateSession();
            return !!sessao;
        }

        let sessao = sessionStorage.getItem('dri_session');

        if (!sessao) {
            sessao = localStorage.getItem('dri_session');
            if (sessao) {
                sessionStorage.setItem('dri_session', sessao);
                sessionStorage.setItem('dri_user', localStorage.getItem('dri_user'));
            }
        }

        if (!sessao) return false;

        const dados = JSON.parse(sessao);
        
        if (new Date(dados.expiracao) < new Date()) {
            await this.logout();
            return false;
        }

        return true;
    },

    async getCurrentUser() {
        const sessao = sessionStorage.getItem('dri_session') || localStorage.getItem('dri_session');
        if (!sessao) return null;
        return JSON.parse(sessao);
    },

    gerarToken() {
        return Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) +
               Date.now().toString(36);
    },

    gerarCodigo() {
        const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const letra = letras[Math.floor(Math.random() * letras.length)];
        const numeros = Math.floor(100 + Math.random() * 900);
        return `${letra}-${numeros}`;
    }
};

window.Auth = Auth;