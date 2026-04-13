const Notif = {

    tocarSom() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.3;
            
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
            osc.stop(audioCtx.currentTime + 0.5);
            
            setTimeout(() => audioCtx.close(), 600);
        } catch(e) {}
    },

    notificar(titulo, mensagem) {
        if (!("Notification" in window)) return;
        
        if (Notification.permission === "granted") {
            new Notification(titulo, {
                body: mensagem,
                icon: "https://i.imgur.com/iUwP1jk.png",
                requireInteraction: true
            });
        }
    },
    
    async verificar() {
        const sessao = sessionStorage.getItem('dri_session') || localStorage.getItem('dri_session');
        if (!sessao) return;
        
        const user = JSON.parse(sessao);
        const hoje = new Date().toISOString().split('T')[0];
        
        try {
            const { data: escalas } = await window.supabase
                .from('escalas_fiscalizador')
                .select('tipo, status')
                .eq('data_funcao', hoje)
                .eq('fiscalizador_nick', user.nick)
                .eq('status', 'PENDENTE');
            
            if (escalas && escalas.length > 0) {
                this.tocarSom();
                this.notificar('DRI System', `Você tem escala HOJE!`);
            }
            
            const { data: usuario } = await window.supabase
                .from('usuarios')
                .select('status, data_retorno')
                .eq('nick', user.nick)
                .single();
            
            if (usuario && usuario.data_retorno) {
                const amanha = new Date();
                amanha.setDate(amanha.getDate() + 1);
                const retorno = new Date(usuario.data_retorno);
                
                if (retorno.toDateString() === amanha.toDateString()) {
                    this.tocarSom();
                    this.notificar('DRI System', 'Sua licença/reserva termina AMANHÃ!');
                }
            }
            
        } catch(e) {}
    },
    
    iniciar() {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        setTimeout(() => this.verificar(), 3000);
        setInterval(() => this.verificar(), 60000);
    }
};