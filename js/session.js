const SessionManager = {
    getDeviceId() {
        let deviceId = localStorage.getItem('device_id');
        
        if (!deviceId) {
            const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const language = navigator.language;
            const platform = navigator.platform;
            const userAgent = navigator.userAgent;

            const deviceString = `${screenInfo}|${timezone}|${language}|${platform}|${userAgent}|${Date.now()}`;
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
        const deviceId = this.getDeviceId();
        const deviceInfo = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString()
        };

        const token = this.generateToken();

        const agoraBrasilia = this.getBrasiliaTime();
        const expiracao = new Date(agoraBrasilia);
        if (manterConectado) {
            expiracao.setDate(expiracao.getDate() + 5);
        } else {
            expiracao.setHours(expiracao.getHours() + 1);
        }

        const { error } = await window.supabase
            .from('sessoes')
            .insert([{
                usuario_nick: nick,
                token: token,
                device_id: deviceId,
                device_info: deviceInfo,
                data_criacao: agoraBrasilia,
                data_expiracao: expiracao,
                ativa: true,
                manter_conectado: manterConectado
            }]);

        if (error) throw error;

        await window.supabase
            .from('usuarios')
            .update({
                ultimo_acesso: agoraBrasilia,
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
    },

    async validateSession() {
        let sessao = this.getStoredSession();
        
        if (!sessao) return null;

        if (new Date(sessao.expiracao) < new Date()) {
            await this.logout();
            return null;
        }

        const currentDeviceId = this.getDeviceId();
        
        const { data: dbSession } = await window.supabase
            .from('sessoes')
            .select('*')
            .eq('token', sessao.token)
            .eq('ativa', true)
            .maybeSingle();

        if (!dbSession) {
            await this.logout();
            return null;
        }

        if (dbSession.device_id !== currentDeviceId) {
            if (!dbSession.manter_conectado) {
                await this.logout();
                return null;
            }

            if (dbSession.manter_conectado && dbSession.device_id !== currentDeviceId) {
                return { ...sessao, requiresValidation: true };
            }
        }

        return sessao;
    },

    getStoredSession() {
        let sessao = sessionStorage.getItem('dri_session');
        
        if (!sessao) {
            sessao = localStorage.getItem('dri_session');
            if (sessao) {
                sessionStorage.setItem('dri_session', sessao);
                sessionStorage.setItem('dri_user', localStorage.getItem('dri_user'));
            }
        }

        return sessao ? JSON.parse(sessao) : null;
    },

    async validateDeviceForLogin(nick) {
        const deviceId = this.getDeviceId();

        const { data: sessions } = await window.supabase
            .from('sessoes')
            .select('*')
            .eq('usuario_nick', nick)
            .eq('device_id', deviceId)
            .eq('ativa', true)
            .gt('data_expiracao', new Date().toISOString())
            .order('data_criacao', { ascending: false })
            .limit(1);

        if (sessions && sessions.length > 0) {
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
        }

        return null;
    },

    async invalidateOtherSessions(nick, currentToken = null) {
        let query = window.supabase
            .from('sessoes')
            .update({ ativa: false })
            .eq('usuario_nick', nick);

        if (currentToken) {
            query = query.neq('token', currentToken);
        }

        await query;
    },

    async logout() {
        const sessao = this.getStoredSession();
        
        if (sessao?.token) {
            await window.supabase
                .from('sessoes')
                .update({ ativa: false })
                .eq('token', sessao.token);
        }

        sessionStorage.clear();
        localStorage.clear();
        
        window.location.href = 'index.html';
    },

    generateToken() {
        return 'sess_' + Math.random().toString(36).substring(2) + 
               Math.random().toString(36).substring(2) +
               Date.now().toString(36) + 
               this.getDeviceId().substring(0, 8);
    },

    getBrasiliaTime() {
        const data = new Date();
        const offsetBrasilia = -3;
        const utc = data.getTime() + (data.getTimezoneOffset() * 60000);
        return new Date(utc + (3600000 * offsetBrasilia));
    },

    formatDeviceInfo(deviceInfo) {
        if (typeof deviceInfo === 'string') {
            try {
                deviceInfo = JSON.parse(deviceInfo);
            } catch {
                return deviceInfo;
            }
        }
        
        const parts = [];
        if (deviceInfo.platform) parts.push(deviceInfo.platform);
        if (deviceInfo.browser) parts.push(deviceInfo.browser);
        if (deviceInfo.screen) parts.push(deviceInfo.screen);
        
        return parts.join(' • ') || 'Dispositivo desconhecido';
    }
};

window.SessionManager = SessionManager;