class WalterZAP {
    constructor() {
        this.currentUser = null;
        this.currentRoom = null;
        this.rooms = [];
        this.messages = [];
        this.contacts = [];
        this.subscriptions = [];
        this.unreadCount = 0;
        this.isVisible = false;
        this.dragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.currentView = 'chats';
        this.emojiPickerVisible = false;
        
        // Lista de emojis comuns
        this.commonEmojis = ['😀', '😂', '😍', '🥰', '😎', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '✨', '⭐', '💯', '🤔', '👀', '🙏', '💪', '🎈'];
        
        this.init();
    }

    async init() {
        await this.waitForUser();
        await this.loadRooms();
        await this.loadContacts();
        this.createUI();
        this.setupEventListeners();
        this.setupRealtime();
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
                .select('*')
                .order('name');

            if (error) throw error;

            const userRooms = [];
            
            for (const room of rooms || []) {
                const { data: members } = await window.supabase
                    .from('room_members')
                    .select('user_nick')
                    .eq('room_id', room.id);

                const isMember = members?.some(m => m.user_nick === this.currentUser?.nick);
                
                if (isMember) {
                    const { data: lastMsg } = await window.supabase
                        .from('room_messages')
                        .select('*')
                        .eq('room_id', room.id)
                        .order('inserted_at', { ascending: false })
                        .limit(1);

                    userRooms.push({
                        ...room,
                        members: members || [],
                        lastMessage: lastMsg?.[0],
                        unreadCount: 0
                    });
                }
            }

            this.rooms = userRooms;
            
            if (this.rooms.length > 0 && !this.currentRoom) {
                this.currentRoom = this.rooms[0];
            }
            
            this.renderContacts();
            
        } catch (error) {
            console.error('Erro ao carregar salas:', error);
        }
    }

    async loadContacts() {
        try {
            const { data: users } = await window.supabase
                .from('usuarios')
                .select('nick, cargo, status')
                .eq('verificado', true)
                .neq('nick', this.currentUser?.nick)
                .order('nick');

            this.contacts = users || [];
        } catch (error) {
            console.error('Erro ao carregar contatos:', error);
        }
    }

    async loadMessages(roomId) {
        try {
            const { data: messages } = await window.supabase
                .from('room_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('inserted_at', { ascending: true })
                .limit(100);

            this.messages = messages || [];
            this.renderMessages();
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    }

    async loadGroupMembers() {
        if (!this.currentRoom || this.currentRoom.type !== 'group') return [];

        try {
            const { data: members } = await window.supabase
                .from('room_members')
                .select('user_nick')
                .eq('room_id', this.currentRoom.id);

            return (members || []).map(m => ({
                nick: m.user_nick,
                role: 'Membro'
            }));
        } catch (error) {
            console.error('Erro ao carregar membros:', error);
            return [];
        }
    }

    setupRealtime() {
        const messageSub = window.supabase
            .channel('walter-messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'room_messages'
                },
                (payload) => this.handleNewMessage(payload.new)
            )
            .subscribe();

        const roomSub = window.supabase
            .channel('walter-rooms')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rooms'
                },
                () => this.loadRooms()
            )
            .subscribe();

        this.subscriptions = [messageSub, roomSub];
    }

    handleNewMessage(message) {
        const room = this.rooms.find(r => r.id === message.room_id);
        
        if (room) {
            room.lastMessage = message;
            
            if (this.currentRoom?.id === message.room_id) {
                this.messages.push(message);
                this.renderMessages();
                this.scrollToBottom();
            } else if (!this.isVisible) {
                room.unreadCount = (room.unreadCount || 0) + 1;
                this.unreadCount++;
                this.updateToggleButton();
            }
            
            this.renderContacts();
        }
    }

    async sendMessage(text, roomId) {
        if (!text.trim() || !roomId) return;

        try {
            const payload = {
                text: text.trim(),
                type: 'text'
            };

            const { error } = await window.supabase
                .from('room_messages')
                .insert({
                    room_id: roomId,
                    sender_nick: this.currentUser?.nick,
                    payload: payload
                });

            if (error) throw error;

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            alert('Erro ao enviar mensagem: ' + error.message);
        }
    }

    toggleEmojiPicker() {
        const picker = document.getElementById('walterEmojiPicker');
        if (picker) {
            this.emojiPickerVisible = !this.emojiPickerVisible;
            picker.style.display = this.emojiPickerVisible ? 'grid' : 'none';
        }
    }

    insertEmoji(emoji) {
        const input = document.getElementById('walterInput');
        if (input) {
            input.value += emoji;
            input.dispatchEvent(new Event('input'));
            input.focus();
        }
        this.toggleEmojiPicker();
    }

    async createGroup(name, description, members) {
        try {
            const { data: room, error } = await window.supabase
                .from('rooms')
                .insert({
                    name: name,
                    description: description || '',
                    created_by_nick: this.currentUser?.nick,
                    type: 'group',
                    avatar_url: 'https://i.imgur.com/iUwP1jk.png',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            await window.supabase
                .from('room_members')
                .insert({
                    room_id: room.id,
                    user_nick: this.currentUser?.nick,
                    created_at: new Date().toISOString()
                });

            if (members && members.length > 0) {
                await window.supabase
                    .from('room_members')
                    .insert(
                        members.map(nick => ({
                            room_id: room.id,
                            user_nick: nick,
                            created_at: new Date().toISOString()
                        }))
                    );
            }

            await window.supabase
                .from('room_messages')
                .insert({
                    room_id: room.id,
                    sender_nick: 'system',
                    payload: {
                        type: 'system',
                        text: `Grupo "${name}" criado por ${this.currentUser?.nick}`
                    }
                });

            await this.loadRooms();
            return room;

        } catch (error) {
            console.error('Erro ao criar grupo:', error);
            throw error;
        }
    }

    async updateGroupInfo(roomId, data) {
        try {
            await window.supabase
                .from('rooms')
                .update(data)
                .eq('id', roomId);

            await this.loadRooms();
            if (this.currentRoom?.id === roomId) {
                this.currentRoom = { ...this.currentRoom, ...data };
            }
        } catch (error) {
            console.error('Erro ao atualizar grupo:', error);
        }
    }

    async addMember(roomId, userNick) {
        try {
            await window.supabase
                .from('room_members')
                .insert({
                    room_id: roomId,
                    user_nick: userNick
                });

            await window.supabase
                .from('room_messages')
                .insert({
                    room_id: roomId,
                    sender_nick: 'system',
                    payload: {
                        type: 'system',
                        text: `${userNick} entrou no grupo`
                    }
                });
        } catch (error) {
            console.error('Erro ao adicionar membro:', error);
        }
    }

    createUI() {
        const html = `
            <div class="walter-toggle" id="walterToggle">
                <i class="ph ph-whatsapp-logo"></i>
            </div>
            
            <div class="walter-container" id="walterContainer">
                <div class="walter-header" id="walterHeader">
                    <div class="walter-header-left">
                        <div class="walter-avatar">
                            <i class="ph ph-whatsapp-logo"></i>
                        </div>
                        <div class="walter-header-info">
                            <h3>WalterZAP</h3>
                            <p>${this.currentUser?.nick || 'Conectado'}</p>
                        </div>
                    </div>
                    <div class="walter-header-actions">
                        <button class="walter-header-btn" id="walterNewGroup">
                            <i class="ph ph-users-three"></i>
                        </button>
                        <button class="walter-header-btn" id="walterMinimize">
                            <i class="ph ph-minus"></i>
                        </button>
                        <button class="walter-header-btn" id="walterClose">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                </div>
                
                <div class="walter-tabs">
                    <button class="walter-tab active" data-tab="chats">
                        <i class="ph ph-chat-circle"></i> Chats
                    </button>
                    <button class="walter-tab" data-tab="contacts">
                        <i class="ph ph-address-book"></i> Contatos
                    </button>
                </div>
                
                <div id="walterChatsView" class="walter-contacts" style="display: block;">
                    ${this.renderChatsList()}
                </div>
                
                <div id="walterContactsView" class="walter-contacts" style="display: none;">
                    ${this.renderContactsList()}
                </div>
                
                <div id="walterChatView" class="walter-chat-area" style="display: none;">
                <div class="walter-chat-header">
                    <button class="walter-back-btn" id="walterBackBtn">
                        <i class="ph ph-arrow-left"></i>
                    </button>
                    <div class="walter-chat-info" id="walterChatInfo">
                        <h3>Selecione um chat</h3>
                        <p>Clique em um chat para começar</p>
                    </div>
                </div>
                
                <div class="walter-messages" id="walterMessages">
                    <div class="walter-loading">
                        <div class="spinner"></div>
                        <p>Carregando mensagens...</p>
                    </div>
                </div>
                
                <div class="walter-input-container">
                    <div class="walter-input-area">
                        <button class="walter-emoji-btn" id="walterEmojiBtn">
                            <i class="ph ph-smiley"></i>
                        </button>
                        <input type="text" class="walter-input" id="walterInput" placeholder="Digite uma mensagem">
                        <button class="walter-send-btn" id="walterSendBtn" disabled>
                            <i class="ph ph-paper-plane-right"></i>
                        </button>
                    </div>
                    
                    <div class="walter-emoji-picker" id="walterEmojiPicker">
                        ${this.commonEmojis.map(emoji => 
                            `<button class="walter-emoji" onclick="window.walterZAP.insertEmoji('${emoji}')">${emoji}</button>`
                        ).join('')}
                    </div>
                </div>
            </div>
            
            <div class="walter-modal" id="walterGroupModal">
                <div class="walter-modal-content">
                    <div class="walter-modal-header">
                        <h2 id="groupModalTitle">Criar novo grupo</h2>
                        <button class="walter-modal-close" id="modalCloseBtn">
                            <i class="ph ph-x"></i>
                        </button>
                    </div>
                    <div class="walter-modal-body" id="groupModalBody">
                        <div class="form-group">
                            <label>Nome do grupo</label>
                            <input type="text" id="groupName" placeholder="Ex: Fiscalizadores">
                        </div>
                        <div class="form-group">
                            <label>Descrição</label>
                            <textarea id="groupDescription" placeholder="Descrição do grupo..." rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>Adicionar membros</label>
                            <select id="groupMembers" multiple size="5">
                                ${this.contacts.map(c => 
                                    `<option value="${c.nick}">${c.nick} (${c.cargo})</option>`
                                ).join('')}
                            </select>
                            <small style="color: var(--walter-text-secondary);">Segure Ctrl para selecionar múltiplos</small>
                        </div>
                    </div>
                    <div class="walter-modal-footer">
                        <button class="walter-btn secondary" id="modalCancelBtn">Cancelar</button>
                        <button class="walter-btn primary" id="modalCreateBtn">Criar grupo</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    renderChatsList() {
        if (!this.rooms || this.rooms.length === 0) {
            return '<div class="walter-loading">Nenhum chat ainda</div>';
        }

        return this.rooms.map(room => {
            const lastMsg = room.lastMessage?.payload?.text || 'Nenhuma mensagem';
            const time = room.lastMessage ? 
                new Date(room.lastMessage.inserted_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) : '';
            const unread = room.unreadCount > 0 ? 
                `<span class="walter-unread">${room.unreadCount}</span>` : '';

            let avatarUrl = room.avatar_url;
            if (!avatarUrl) {
                if (room.type === 'group') {
                    avatarUrl = 'https://i.imgur.com/iUwP1jk.png';
                } else {
                    const otherMember = room.members?.find(m => m.user_nick !== this.currentUser?.nick);
                    avatarUrl = `https://www.habbo.com.br/habbo-imaging/avatarimage?&user=${otherMember?.user_nick || 'Padrao'}&action=std&direction=2&head_direction=3&img_format=png&gesture=sml&headonly=1&size=s`;
                }
            }

            return `
                <div class="walter-contact ${this.currentRoom?.id === room.id ? 'selected' : ''}" 
                    onclick="window.walterZAP.openChat('${room.id}')">
                    <div class="walter-contact-avatar ${room.type === 'group' ? 'group' : ''}">
                        <img src="${avatarUrl}" 
                            alt="${room.name}"
                            onerror="this.src='https://www.habbo.com.br/habbo-imaging/avatarimage?&user=Padrao&action=std&direction=2&head_direction=3&img_format=png&gesture=sml&headonly=0&size=s'">
                        ${room.type === 'group' ? '<i class="ph ph-users" style="position: absolute; bottom: -2px; right: -2px; background: var(--walter-primary); color: white; border-radius: 50%; padding: 2px; font-size: 12px;"></i>' : ''}
                    </div>
                    <div class="walter-contact-info">
                        <div class="walter-contact-name">
                            <h4>${room.name}</h4>
                            <span class="walter-contact-time">${time}</span>
                        </div>
                        <div class="walter-contact-last">
                            <p>${lastMsg}</p>
                            ${unread}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderContactsList() {
        if (!this.contacts || this.contacts.length === 0) {
            return '<div class="walter-loading">Nenhum contato disponível</div>';
        }

        return this.contacts.map(contact => `
            <div class="walter-contact" onclick="window.walterZAP.startPrivateChat('${contact.nick}')">
                <div class="walter-contact-avatar">
                    <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?&user=${contact.nick}&action=std&direction=2&head_direction=3&img_format=png&gesture=sml&headonly=1&size=s" 
                         alt="${contact.nick}"
                         onerror="this.src='https://www.habbo.com.br/habbo-imaging/avatarimage?&user=Padrao&action=std&direction=2&head_direction=3&img_format=png&gesture=sml&headonly=0&size=s'">
                </div>
                <div class="walter-contact-info">
                    <div class="walter-contact-name">
                        <h4>${contact.nick}</h4>
                    </div>
                    <div class="walter-contact-last">
                        <p>${contact.cargo} • ${contact.status || 'ATIVO'}</p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderMessages() {
        const messagesDiv = document.getElementById('walterMessages');
        if (!messagesDiv) return;

        if (!this.messages || this.messages.length === 0) {
            messagesDiv.innerHTML = '<div class="walter-loading">Nenhuma mensagem ainda</div>';
            return;
        }

        messagesDiv.innerHTML = this.messages.map(msg => {
            const isOwn = msg.sender_nick === this.currentUser?.nick;
            const time = new Date(msg.inserted_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            if (msg.payload?.type === 'system') {
                return `
                    <div class="walter-message system" style="align-self: center; max-width: 80%;">
                        <div class="walter-message-bubble" style="background: var(--walter-bg-lighter); text-align: center; font-style: italic;">
                            ${msg.payload.text}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="walter-message ${isOwn ? 'own' : 'other'}">
                    <div class="walter-message-bubble">
                        ${!isOwn ? `<strong style="color: var(--walter-primary); display: block; margin-bottom: 2px;">${msg.sender_nick}</strong>` : ''}
                        ${msg.payload?.text || ''}
                    </div>
                    <span class="walter-message-time">${time}</span>
                </div>
            `;
        }).join('');
    }

    async openChat(roomId) {
        this.currentRoom = this.rooms.find(r => r.id === roomId);
        if (!this.currentRoom) return;

        this.currentRoom.unreadCount = 0;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.updateToggleButton();

        await this.loadMessages(roomId);

        document.getElementById('walterChatsView').style.display = 'none';
        document.getElementById('walterContactsView').style.display = 'none';
        document.getElementById('walterChatView').style.display = 'flex';
        
        const backBtn = document.getElementById('walterBackBtn');
        if (backBtn) {
            backBtn.style.display = 'flex';
        }
        
        const chatInfo = document.getElementById('walterChatInfo');
        chatInfo.innerHTML = `
            <h3>${this.currentRoom.name}</h3>
            <p>${this.currentRoom.type === 'group' ? (this.currentRoom.description || '') : ''}</p>
        `;

        // Esconder o emoji picker ao abrir novo chat
        const emojiPicker = document.getElementById('walterEmojiPicker');
        if (emojiPicker) {
            emojiPicker.style.display = 'none';
            this.emojiPickerVisible = false;
        }

        this.renderContacts();
    }

    goBack() {
        document.getElementById('walterChatView').style.display = 'none';
        document.getElementById('walterChatsView').style.display = 'block';
        
        const backBtn = document.getElementById('walterBackBtn');
        if (backBtn) {
            backBtn.style.display = 'none';
        }
        
        this.currentRoom = null;
        this.messages = [];
    }

    async startPrivateChat(userNick) {
        let room = this.rooms.find(r => 
            r.type === 'private' && 
            r.members?.some(m => m.user_nick === userNick) &&
            r.members?.some(m => m.user_nick === this.currentUser?.nick)
        );

        if (!room) {
            const name = [this.currentUser?.nick, userNick].sort().join(' & ');
            
            const { data } = await window.supabase
                .from('rooms')
                .insert({
                    name: name,
                    type: 'private',
                    created_by_nick: this.currentUser?.nick,
                    avatar_url: null
                })
                .select()
                .single();

            await window.supabase
                .from('room_members')
                .insert([
                    { room_id: data.id, user_nick: this.currentUser?.nick },
                    { room_id: data.id, user_nick: userNick }
                ]);

            room = data;
            await this.loadRooms();
        }

        await this.openChat(room.id);
    }

    async createGroupFromModal() {
        const name = document.getElementById('groupName').value.trim();
        const description = document.getElementById('groupDescription').value.trim();
        const members = Array.from(document.getElementById('groupMembers').selectedOptions)
            .map(opt => opt.value);

        if (!name) {
            alert('Digite um nome para o grupo');
            return;
        }

        await this.createGroup(name, description, members);
        document.getElementById('walterGroupModal').classList.remove('show');
        
        document.getElementById('groupName').value = '';
        document.getElementById('groupDescription').value = '';
        document.getElementById('groupMembers').selectedIndex = -1;
    }

    setupEventListeners() {
        const toggle = document.getElementById('walterToggle');
        const closeBtn = document.getElementById('walterClose');
        const minimizeBtn = document.getElementById('walterMinimize');
        const newGroupBtn = document.getElementById('walterNewGroup');
        const tabs = document.querySelectorAll('.walter-tab');
        const backBtn = document.getElementById('walterBackBtn');
        const input = document.getElementById('walterInput');
        const sendBtn = document.getElementById('walterSendBtn');
        const emojiBtn = document.getElementById('walterEmojiBtn');
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const modalCreateBtn = document.getElementById('modalCreateBtn');

        if (toggle) {
            toggle.addEventListener('click', () => this.toggleChat());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideChat());
        }

        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => this.hideChat());
        }

        if (newGroupBtn) {
            newGroupBtn.addEventListener('click', () => {
                document.getElementById('walterGroupModal').classList.add('show');
            });
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                document.getElementById('walterGroupModal').classList.remove('show');
            });
        }

        if (modalCancelBtn) {
            modalCancelBtn.addEventListener('click', () => {
                document.getElementById('walterGroupModal').classList.remove('show');
            });
        }

        if (modalCreateBtn) {
            modalCreateBtn.addEventListener('click', () => this.createGroupFromModal());
        }

        if (tabs) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const view = tab.dataset.tab;
                    document.getElementById('walterChatsView').style.display = 
                        view === 'chats' ? 'block' : 'none';
                    document.getElementById('walterContactsView').style.display = 
                        view === 'contacts' ? 'block' : 'none';
                });
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => this.goBack());
        }

        if (input && sendBtn) {
            input.addEventListener('input', () => {
                sendBtn.disabled = !input.value.trim();
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.value.trim() && this.currentRoom) {
                        this.sendMessage(input.value, this.currentRoom.id);
                        input.value = '';
                        sendBtn.disabled = true;
                    }
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                if (input.value.trim() && this.currentRoom) {
                    this.sendMessage(input.value, this.currentRoom.id);
                    input.value = '';
                    sendBtn.disabled = true;
                    
                    // Fechar emoji picker ao enviar
                    if (this.emojiPickerVisible) {
                        this.toggleEmojiPicker();
                    }
                }
            });
        }

        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        }

        // Fechar emoji picker ao clicar fora
        document.addEventListener('click', (e) => {
            if (this.emojiPickerVisible && 
                !e.target.closest('.walter-emoji-picker') && 
                !e.target.closest('#walterEmojiBtn')) {
                const picker = document.getElementById('walterEmojiPicker');
                if (picker) {
                    picker.style.display = 'none';
                    this.emojiPickerVisible = false;
                }
            }
        });

        const header = document.getElementById('walterHeader');
        if (header) {
            header.addEventListener('mousedown', (e) => this.startDrag(e));
            document.addEventListener('mousemove', (e) => this.onDrag(e));
            document.addEventListener('mouseup', () => this.stopDrag());
        }
    }

    toggleChat() {
        const container = document.getElementById('walterContainer');
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
        const container = document.getElementById('walterContainer');
        if (container) {
            container.classList.remove('visible');
            this.isVisible = false;
        }
    }

    updateToggleButton() {
        const toggle = document.getElementById('walterToggle');
        if (toggle) {
            if (this.unreadCount > 0) {
                toggle.classList.add('has-unread');
            } else {
                toggle.classList.remove('has-unread');
            }
        }
    }

    scrollToBottom() {
        const messagesDiv = document.getElementById('walterMessages');
        if (messagesDiv) {
            setTimeout(() => {
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 100);
        }
    }

    renderContacts() {
        const chatsDiv = document.getElementById('walterChatsView');
        if (chatsDiv) {
            chatsDiv.innerHTML = this.renderChatsList();
        }
    }

    startDrag(e) {
        if (e.target.closest('.walter-header-actions')) return;
        
        this.dragging = true;
        const container = document.getElementById('walterContainer');
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
        
        const container = document.getElementById('walterContainer');
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
            const container = document.getElementById('walterContainer');
            container.style.transition = 'all 0.3s ease';
            container.style.cursor = 'default';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.Auth) {
            window.walterZAP = new WalterZAP();
        }
    }, 1500);
});