const SessionManager = {
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        
        if (!deviceId) {
            const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const language = navigator.language;
            const platform = navigator.platform;
            
            const deviceString = `${screenInfo}|${timezone}|${language}|${platform}|${Date.now()}`;
            deviceId = this.hashString(deviceString);
            
            localStorage.setItem('device_id', deviceId);
        }
        
        return deviceId;
    },

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
    },

    async createSession(nick, cargo, manterConectado = true) {
        try {
            const deviceId = this.getDeviceId();
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screen: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

            const token = this.generateToken();

            const agora = new Date();
            const expiracao = new Date(agora);
            if (manterConectado) {
                expiracao.setDate(expiracao.getDate() + 5);
            } else {
                expiracao.setHours(expiracao.getHours() + 1);
            }

            await window.supabase
                .from('sessoes')
                .update({ ativa: false })
                .eq('device_id', deviceId)
                .eq('ativa', true);

            const { error } = await window.supabase
                .from('sessoes')
                .insert([{
                    usuario_nick: nick,
                    token: token,
                    device_id: deviceId,
                    device_info: deviceInfo,
                    data_criacao: agora.toISOString(),
                    data_expiracao: expiracao.toISOString(),
                    ativa: true,
                    manter_conectado: manterConectado
                }]);

            if (error) throw error;

            await window.supabase
                .from('usuarios')
                .update({
                    ultimo_acesso: agora.toISOString(),
                    ultimo_device_id: deviceId
                })
                .eq('nick', nick);

            const sessao = {
                nick,
                token,
                cargo,
                expiracao: expiracao.toISOString(),
                deviceId,
                manterConectado
            };

            sessionStorage.setItem('dri_session', JSON.stringify(sessao));
            sessionStorage.setItem('dri_user', nick);

            if (manterConectado) {
                localStorage.setItem('dri_session', JSON.stringify(sessao));
                localStorage.setItem('dri_user', nick);
            } else {
                localStorage.removeItem('dri_session');
                localStorage.removeItem('dri_user');
            }

            return { success: true, token };

        } catch (error) {
            console.error('Erro ao criar sessão:', error);
            throw error;
        }
    },

    async validateSession() {
        try {
            const sessao = this.getStoredSession();
            
            if (!sessao) return null;

            if (new Date(sessao.expiracao) < new Date()) {
                await this.logout();
                return null;
            }

            const { data: dbSession, error } = await window.supabase
                .from('sessoes')
                .select('*')
                .eq('token', sessao.token)
                .eq('ativa', true)
                .maybeSingle();

            if (error || !dbSession) {
                await this.logout();
                return null;
            }

            if (new Date(dbSession.data_expiracao) < new Date()) {
                await this.logout();
                return null;
            }

            return sessao;

        } catch (error) {
            console.error('Erro ao validar sessão:', error);
            return null;
        }
    },

    getStoredSession() {
        try {
            let sessao = sessionStorage.getItem('dri_session');
            
            if (!sessao) {
                sessao = localStorage.getItem('dri_session');
                if (sessao) {
                    sessionStorage.setItem('dri_session', sessao);
                    sessionStorage.setItem('dri_user', localStorage.getItem('dri_user'));
                }
            }

            return sessao ? JSON.parse(sessao) : null;
        } catch (error) {
            console.error('Erro ao obter sessão armazenada:', error);
            return null;
        }
    },

    async validateDeviceForLogin(nick) {
        try {
            const deviceId = this.getDeviceId();

            const { data: sessions, error } = await window.supabase
                .from('sessoes')
                .select('*')
                .eq('usuario_nick', nick)
                .eq('device_id', deviceId)
                .eq('ativa', true)
                .gt('data_expiracao', new Date().toISOString())
                .order('data_criacao', { ascending: false })
                .limit(1);

            if (error || !sessions || sessions.length === 0) {
                return null;
            }

            const session = sessions[0];

            const sessao = {
                nick: session.usuario_nick,
                token: session.token,
                cargo: session.cargo || 'Fiscalizador',
                expiracao: session.data_expiracao,
                deviceId: session.device_id,
                manterConectado: session.manter_conectado
            };

            sessionStorage.setItem('dri_session', JSON.stringify(sessao));
            sessionStorage.setItem('dri_user', nick);

            if (session.manter_conectado) {
                localStorage.setItem('dri_session', JSON.stringify(sessao));
                localStorage.setItem('dri_user', nick);
            }

            return sessao;

        } catch (error) {
            console.error('Erro ao validar dispositivo:', error);
            return null;
        }
    },

    async logout() {
        try {
            const sessao = this.getStoredSession();
            
            if (sessao?.token) {
                await window.supabase
                    .from('sessoes')
                    .update({ ativa: false })
                    .eq('token', sessao.token);
            }
        } catch (error) {
            console.error('Erro ao fazer logout no banco:', error);
        } finally {
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = 'index.html';
        }
    },

    async getCurrentUser() {
        return this.getStoredSession();
    },

    generateToken() {
        return 'sess_' + Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) +
               Date.now().toString(36);
    }
};

window.SessionManager = SessionManager;