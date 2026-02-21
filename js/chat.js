class ChatManager {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms = [];
        this.messages = [];
        this.subscription = null;
        this.typingSubscription = null;
        this.typingTimeout = null;
        this.unreadCount = 0;
        this.isVisible = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        this.init();
    }

    async init() {
        await this.waitForUser();
        await this.loadRooms();
        this.createUI();
        this.setupEventListeners();
    }

    async waitForUser() {
        while (!window.currentUser && !window.Auth?.getCurrentUser()) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.currentUser = window.currentUser || await window.Auth?.getCurrentUser();
    }

    async loadRooms() {
        try {
            const { data: rooms, error } = await window.supabase
                .from('rooms')
                .select(`
                    id,
                    name,
                    created_by_nick,
                    created_at,
                    room_members!inner(user_nick)
                `)
                .eq('room_members.user_nick', this.currentUser?.nick)
                .order('name');

            if (error) {
                console.error('Erro ao buscar salas:', error);
                return;
            }

            console.log('Salas encontradas:', rooms);
            this.rooms = rooms || [];
            
            if (this.rooms.length > 0) {
                this.currentRoom = this.rooms[0];
                await this.loadMessages();
                await this.subscribeToRoom();
            } else {
                console.log('Nenhuma sala encontrada para o usuário');
            }
        } catch (error) {
            console.error('Erro ao carregar salas:', error);
        }
    }

    async loadMessages() {
        if (!this.currentRoom) return;

        try {
            console.log('Carregando mensagens da sala:', this.currentRoom.id);
            
            const { data: messages, error } = await window.supabase
                .from('room_messages')
                .select('*')
                .eq('room_id', this.currentRoom.id)
                .order('inserted_at', { ascending: true })
                .limit(100);

            if (error) {
                console.error('Erro ao carregar mensagens:', error);
                return;
            }

            console.log(`${messages?.length || 0} mensagens carregadas`);
            this.messages = messages || [];
            this.renderMessages();
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    }

    async subscribeToRoom() {
        if (!this.currentRoom) return;

        if (this.subscription) {
            await this.subscription.unsubscribe();
        }
        if (this.typingSubscription) {
            await this.typingSubscription.unsubscribe();
        }

        const roomId = this.currentRoom.id;
        console.log('Inscrevendo na sala:', roomId);

        this.subscription = window.supabase
            .channel(`room-${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => this.handleNewMessage(payload.new)
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'room_messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => this.handleUpdateMessage(payload.new)
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'room_messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => this.handleDeleteMessage(payload.old)
            )
            .subscribe((status) => {
                console.log('Status da subscrição de mensagens:', status);
            });

        this.typingSubscription = window.supabase
            .channel(`typing-${roomId}`)
            .on(
                'broadcast',
                { event: 'typing' },
                (payload) => this.handleTyping(payload)
            )
            .subscribe((status) => {
                console.log('Status da subscrição de digitação:', status);
            });
    }

    handleNewMessage(message) {
        console.log('Nova mensagem:', message);
        this.messages.push(message);
        this.renderMessages();
        
        if (!this.isVisible) {
            this.unreadCount++;
            this.updateToggleButton();
        }

        if (message.sender_nick === this.currentUser?.nick) {
            setTimeout(() => this.scrollToBottom(), 100);
        }
    }

    handleUpdateMessage(message) {
        const index = this.messages.findIndex(m => m.id === message.id);
        if (index !== -1) {
            this.messages[index] = message;
            this.renderMessages();
        }
    }

    handleDeleteMessage(message) {
        this.messages = this.messages.filter(m => m.id !== message.id);
        this.renderMessages();
    }

    handleTyping(payload) {
        if (payload.payload?.user !== this.currentUser?.nick) {
            const typingDiv = document.getElementById('chatTyping');
            if (typingDiv) {
                typingDiv.textContent = `${payload.payload?.user || 'Alguém'} está digitando...`;
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    typingDiv.textContent = '';
                }, 3000);
            }
        }
    }

    async sendMessage(text) {
        if (!text.trim() || !this.currentRoom) return;

        try {
            const payload = {
                text: text.trim(),
                type: 'text',
                sender_nick: this.currentUser?.nick
            };

            console.log('Enviando mensagem:', payload);

            const { error } = await window.supabase
                .from('room_messages')
                .insert({
                    room_id: this.currentRoom.id,
                    sender_nick: this.currentUser?.nick,
                    payload: payload
                });

            if (error) {
                console.error('Erro ao enviar mensagem:', error);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }

    async sendTyping() {
        if (!this.currentRoom) return;

        try {
            await this.typingSubscription?.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: this.currentUser?.nick }
            });
        } catch (error) {
        }
    }

    createUI() {
        const roomOptions = this.rooms.map(room => 
            `<option value="${room.id}" ${room.id === this.currentRoom?.id ? 'selected' : ''}>
                ${room.name}
            </option>`
        ).join('');

        const chatHTML = `
            <div class="chat-toggle-button" id="chatToggle">
                <i class="ph ph-chat-circle"></i>
            </div>
            
            <div class="chat-container" id="chatContainer">
                <div class="chat-header" id="chatHeader">
                    <div class="chat-header-title">
                        <span>Chat do DRI</span>
                    </div>
                    <div class="chat-header-actions">
                        <button class="chat-header-btn" id="chatMinimize">
                            <i class="ph ph-minus"></i>
                        </button>
                        <button class="chat-header-btn" id="chatClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                </div>
                
                <div class="chat-room-selector" id="chatRoomSelector">
                    <select class="chat-room-select" id="chatRoomSelect">
                        ${roomOptions || '<option value="">Nenhuma sala disponível</option>'}
                    </select>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-loading">Carregando mensagens...</div>
                </div>
                
                <div class="chat-typing" id="chatTyping"></div>
                
                <div class="chat-input-area">
                    <textarea 
                        class="chat-input" 
                        id="chatInput" 
                        placeholder="Digite sua mensagem..."
                        rows="1"
                        ${!this.currentRoom ? 'disabled' : ''}
                    ></textarea>
                    <button class="chat-send-btn" id="chatSendBtn" disabled>
                        <i class="ph ph-paper-plane-right"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);

        if (this.messages.length > 0) {
            this.renderMessages();
        }
    }

    renderMessages() {
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = this.renderMessagesHTML();
            this.scrollToBottom();
        }
    }

    renderMessagesHTML() {
        if (!this.messages || this.messages.length === 0) {
            return '<div class="chat-loading">Nenhuma mensagem ainda</div>';
        }

        return this.messages.map(msg => {
            const isOwn = msg.sender_nick === this.currentUser?.nick;
            const time = new Date(msg.inserted_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const sender = msg.payload?.sender_nick || msg.sender_nick || 'Sistema';

            if (msg.payload?.type === 'system') {
                return `
                    <div class="chat-message system">
                        ${msg.payload.text}
                    </div>
                `;
            }

            return `
                <div class="chat-message ${isOwn ? 'own' : 'other'}">
                    <div class="chat-message-header">
                        <span class="chat-message-author">${sender}</span>
                        <span class="chat-message-time">${time}</span>
                    </div>
                    <div class="chat-message-content">${msg.payload?.text || '...'}</div>
                </div>
            `;
        }).join('');
    }

    scrollToBottom() {
        const messagesDiv = document.getElementById('chatMessages');
        if (messagesDiv) {
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 100);
        }
    }

    updateToggleButton() {
        const toggle = document.getElementById('chatToggle');
        if (toggle) {
            if (this.unreadCount > 0) {
                toggle.classList.add('has-unread');
                toggle.innerHTML = `<i class="ph ph-chat-circle"></i>
                    <span style="position: absolute; top: 0; right: 0; background: var(--info); color: white; font-size: 0.7rem; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${this.unreadCount}</span>`;
            } else {
                toggle.classList.remove('has-unread');
                toggle.innerHTML = '<i class="ph ph-chat-circle"></i>';
            }
        }
    }

    setupEventListeners() {
        const toggle = document.getElementById('chatToggle');
        const container = document.getElementById('chatContainer');
        const closeBtn = document.getElementById('chatClose');
        const minimizeBtn = document.getElementById('chatMinimize');
        const roomSelect = document.getElementById('chatRoomSelect');
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');

        if (toggle) {
            toggle.addEventListener('click', () => this.toggleChat());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideChat());
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.hideChat());
        }

        if (roomSelect) {
            roomSelect.addEventListener('change', (e) => this.changeRoom(e.target.value));
        }

        if (input) {
            input.addEventListener('input', () => {
                sendBtn.disabled = !input.value.trim();
                
                clearTimeout(this.typingTimeout);
                this.typingTimeout = setTimeout(() => {
                    this.sendTyping();
                }, 500);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.value.trim()) {
                        this.sendMessage(input.value);
                        input.value = '';
                        sendBtn.disabled = true;
                    }
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (input.value.trim()) {
                    this.sendMessage(input.value);
                    input.value = '';
                    sendBtn.disabled = true;
                }
            });
        }

        const header = document.getElementById('chatHeader');
        if (header) {
            header.addEventListener('mousedown', (e) => this.startDrag(e));
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('mouseup', () => this.stopDrag());
        }
    }

    toggleChat() {
        const container = document.getElementById('chatContainer');
        if (container) {
            container.classList.toggle('visible');
            this.isVisible = container.classList.contains('visible');
            
            if (this.isVisible) {
                this.unreadCount = 0;
                this.updateToggleButton();
                this.scrollToBottom();
            }
        }
    }

    hideChat() {
        const container = document.getElementById('chatContainer');
        if (container) {
            container.classList.remove('visible');
            this.isVisible = false;
        }
    }

    async changeRoom(roomId) {
        this.currentRoom = this.rooms.find(r => r.id === roomId);
        if (this.currentRoom) {
            console.log('Mudando para sala:', this.currentRoom.name);
            await this.loadMessages();
            await this.subscribeToRoom();

            const input = document.getElementById('chatInput');
            if (input) {
                input.disabled = false;
                input.focus();
            }
        }
    }

    startDrag(e) {
        if (e.target.closest('.chat-header-actions')) return;
        
        this.dragging = true;
        const container = document.getElementById('chatContainer');
        const rect = container.getBoundingClientRect();
        
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        container.style.transition = 'none';
        container.style.cursor = 'grabbing';
    }

    onDrag(e) {
        if (!this.dragging) return;
        
        const container = document.getElementById('chatContainer');
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;
        
        container.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        container.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    stopDrag() {
        if (this.dragging) {
            this.dragging = false;
            const container = document.getElementById('chatContainer');
            container.style.transition = 'all 0.3s ease';
            container.style.cursor = 'default';
        }
    }
}

// Inicializar chat quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.Auth) {
            window.chatManager = new ChatManager();
        } else {
            console.error('Auth não carregado');
        }
    }, 1500);
});