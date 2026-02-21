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

            const codigo = Utils.gerarCodigo();
            console.log(`Código gerado para ${nick}: ${codigo}`);

            const cargo = nick.toLowerCase() === 'youiz' ? 'DEV' : 'Fiscalizador';

            const agoraBrasilia = Utils.getBrasiliaTime();

            const { error } = await window.supabase
                .from('usuarios')
                .insert([{
                    nick: nick,
                    senha: senha,
                    cargo: cargo,
                    verificado: false,
                    data_criacao: agoraBrasilia.toISOString(),
                    status: 'ATIVO'
                }]);

            if (error) throw error;

            const expiraEm = new Date(agoraBrasilia);
            expiraEm.setMinutes(expiraEm.getMinutes() + 5);

            await window.supabase
                .from('codigos_verificacao')
                .insert([{
                    usuario_nick: nick,
                    codigo: codigo,
                    tipo: 'CRIACAO',
                    expira_em: expiraEm.toISOString(),
                    usado: false
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

    async verifyMotto(nick, codigo) {
        return await Utils.verificarMottoHabbo(nick, codigo);
    },

    async verificarEAtivar(nick, codigo) {
        try {
            const agora = Utils.getBrasiliaTime();

            const { data: codigoData, error: codigoError } = await window.supabase
                .from('codigos_verificacao')
                .select('*')
                .eq('usuario_nick', nick)
                .eq('codigo', codigo)
                .eq('usado', false)
                .gt('expira_em', agora.toISOString())
                .maybeSingle();

            if (codigoError || !codigoData) {
                console.log('Código não encontrado ou expirado:', { nick, codigo, agora: agora.toISOString() });
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
            const senhaHash = await Utils.hashPassword(senha);

            const { data: usuario, error } = await window.supabase
                .from('usuarios')
                .select('*')
                .eq('nick', nick)
                .eq('verificado', true)
                .maybeSingle();

            if (error || !usuario) {
                return { success: false, message: 'Nick ou senha inválidos' };
            }

            const senhaValida = await Utils.comparePassword(senha, usuario.senha);
            if (!senhaValida) {
                return { success: false, message: 'Nick ou senha inválidos' };
            }

            if (usuario.status !== 'ATIVO') {
                let mensagem = 'Usuário não está ativo';
                if (usuario.status === 'BLOQUEADO') mensagem = 'Usuário bloqueado';
                if (usuario.status === 'LICENCA') mensagem = 'Usuário em licença';
                if (usuario.status === 'RESERVA') mensagem = 'Usuário na reserva';
                return { success: false, message: mensagem };
            }

            const token = this.gerarToken();
            const agora = Utils.getBrasiliaTime();
            const expiracao = new Date(agora);
            expiracao.setDate(expiracao.getDate() + (manterConectado ? 5 : 1));

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

            await window.supabase
                .from('usuarios')
                .update({ ultimo_acesso: agora.toISOString() })
                .eq('nick', nick);

            return { success: true };

        } catch (error) {
            console.error('Erro no login:', error);
            return { success: false, message: 'Erro no login: ' + error.message };
        }
    },

    async redefinirSenha(nick, codigo, novaSenha) {
        try {
            const agora = Utils.getBrasiliaTime();

            const { data: codigoData } = await window.supabase
                .from('codigos_verificacao')
                .select('*')
                .eq('usuario_nick', nick)
                .eq('codigo', codigo)
                .eq('tipo', 'REDEFINIR')
                .eq('usado', false)
                .gt('expira_em', agora.toISOString())
                .maybeSingle();

            if (!codigoData) {
                return { success: false, message: 'Código inválido ou expirado' };
            }

            const encontrado = await this.verifyMotto(nick, codigo);
            
            if (!encontrado) {
                return { success: false, message: 'Código não encontrado na missão' };
            }

            const { error } = await window.supabase
                .from('usuarios')
                .update({ senha: novaSenha })
                .eq('nick', nick);

            if (error) throw error;

            await window.supabase
                .from('codigos_verificacao')
                .update({ usado: true })
                .eq('id', codigoData.id);

            return { success: true, message: 'Senha redefinida com sucesso!' };

        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            return { success: false, message: 'Erro ao redefinir senha' };
        }
    },

    async logout() {
        try {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Erro no logout:', error);
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'index.html';
        }
    },

    async isAuthenticated() {
        try {
            let sessao = sessionStorage.getItem('dri_session');
            if (!sessao) {
                sessao = localStorage.getItem('dri_session');
            }

            if (!sessao) return false;

            const dados = JSON.parse(sessao);
            
            if (new Date(dados.expiracao) < new Date()) {
                await this.logout();
                return false;
            }

            return true;
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
            return false;
        }
    },

    async getCurrentUser() {
        try {
            const sessao = sessionStorage.getItem('dri_session') || localStorage.getItem('dri_session');
            if (!sessao) return null;
            return JSON.parse(sessao);
        } catch (error) {
            console.error('Erro ao obter usuário atual:', error);
            return null;
        }
    },

    gerarToken() {
        return Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) +
               Date.now().toString(36);
    }
};

window.Auth = Auth;