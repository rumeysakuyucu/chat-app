// ===================== 1. TEMA AYARLARI (EN ÜST) =====================
let currentTheme = localStorage.getItem('theme') || 'dark';

window.toggleTheme = function() {
    console.log('Tema değiştiriliyor...');
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    localStorage.setItem('theme', currentTheme);
}

function applyTheme(theme) {
    const root = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    
    if (theme === 'light') {
        root.classList.add('light-theme');
        if (themeBtn) themeBtn.innerHTML = '🌙';
    } else {
        root.classList.remove('light-theme');
        if (themeBtn) themeBtn.innerHTML = '☀️';
    }
}

// ===================== 2. GLOBAL FONKSİYONLAR =====================
window.formatFileSize = function(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

window.scrollToMessage = function(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        setTimeout(() => {
            messageDiv.style.backgroundColor = '';
        }, 2000);
    }
};

window.addReaction = function(messageId, reaction) {
    if (!window.socket) {
        console.error('❌ Socket bağlı değil!');
        return;
    }
    window.socket.emit("add reaction", { messageId, reaction });
};

// ===================== 3. ANA KOD (DOMContentLoaded) =====================
document.addEventListener("DOMContentLoaded", () => {
    applyTheme(currentTheme);
    console.log("🚀 Chat sayfası yüklendi");
    
    // ========== TOKEN KONTROL ==========
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "/login.html";
        return;
    }
    
    // ========== ELEMENTLER ==========
    const chatBox = document.getElementById("chatBox");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const roomSelect = document.getElementById("roomSelect");
    const emojiBtn = document.getElementById("emojiBtn");
    const emojiPanel = document.getElementById("emojiPanel");
    const emojiContent = document.getElementById("emojiContent");
    const emojiSearch = document.getElementById("emojiSearch");
    const emojiTabs = document.querySelectorAll('.emoji-tab');
    const viewOnceBtn = document.getElementById('viewOnceBtn');
    const fileBtn = document.getElementById('fileBtn');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSizeSpan = document.getElementById('fileSize');
    const cancelFileBtn = document.getElementById('cancelFileBtn');
    
    // ========== DEĞİŞKENLER ==========
    window.currentRoom = "general";
    window.viewOnceActive = false;
    let selectedFile = null;
    let visibleMessageIds = new Set();
    let readTimeout = null;
    let replyingTo = null;
    let replyPreview = null;
    
    // ========== SOCKET TANIMI ==========
    window.socket = io('http://localhost:3000', { 
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000
    });
    
    window.socket.on('connect', () => {
        console.log('✅ Socket BAĞLANDI! ID:', window.socket.id);
        window.socket.emit('join room', window.currentRoom);
    });
    
    window.socket.on('connect_error', (err) => {
        console.error('❌ Socket HATASI:', err.message);
    });
    
    window.socket.on("load messages", (messages) => {
        console.log("📥 load messages EVENTİ ÇALIŞTI!", messages.length);
        chatBox.innerHTML = "";
        messages.forEach(msg => window.addMessageToChat(msg));
    });
   window.socket.on("chat message", (msg) => {
    console.log("📨 MESAJ GELDİ:", msg.message);
    // if (msg.username !== localStorage.getItem("username")) {
    //     playSound('messageSound');  // BU SATIRI YORUM YAP
    // }
    window.addMessageToChat(msg);
});

// ========== TEPKİ GÜNCELLEME ==========
window.socket.on("reaction updated", (data) => {
    const messageDiv = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (!messageDiv) return;
    
    let reactionsDiv = messageDiv.querySelector('.message-reactions');
    if (!reactionsDiv) {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'message-reactions';
        reactionsDiv.style.display = 'flex';
        reactionsDiv.style.gap = '5px';
        reactionsDiv.style.marginTop = '5px';
        reactionsDiv.style.flexWrap = 'wrap';
        
        const contentDiv = messageDiv.querySelector('[style*="margin-left: 32px;"]');
        if (contentDiv) {
            contentDiv.appendChild(reactionsDiv);
        } else {
            messageDiv.appendChild(reactionsDiv);
        }
    }
    
    reactionsDiv.innerHTML = '';
    const reactions = data.reactions;
    
    if (reactions && Object.keys(reactions).length > 0) {
        Object.entries(reactions).forEach(([reaction, users]) => {
            const btn = document.createElement('button');
            btn.textContent = `${reaction} ${users.length}`;
            btn.style.background = '#334155';
            btn.style.border = 'none';
            btn.style.color = 'white';
            btn.style.padding = '2px 8px';
            btn.style.borderRadius = '12px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '12px';
            btn.style.margin = '2px';
            btn.onclick = () => window.addReaction(data.messageId, reaction);
            reactionsDiv.appendChild(btn);
        });
    }
});
    
  window.socket.on("online users", async (users) => {
    const onlineList = document.getElementById("onlineUsersList");
    if (onlineList) {
        if (users.length === 0) {
            onlineList.innerHTML = '<li class="online-user">Kimse yok</li>';
        } else {
            let html = '';
            for (const user of users) {
                // 🔥 KENDİNİ GÖSTERME
                if (user === localStorage.getItem("username")) continue;
                
                // 🔥 ENGELLENEN KULLANICILARI FİLTRELE
                const isBlocked = await window.checkBlockStatus(user);
                if (isBlocked) continue;  // Engellenen kişiyi gösterme
                
                html += `<li class="online-user">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div onclick="showUserProfile('${user}')">
                            <span class="online-dot"></span>
                            <span>${user}</span>
                        </div>
                        <button onclick="toggleBlock('${user}', this)" 
                                style="background: transparent; color: #94a3b8; border-radius: 15px; padding: 3px 10px; font-size: 11px;">
                            🚫 Engelle
                        </button>
                    </div>
                </li>`;
            }
            
            if (html === '') {
                onlineList.innerHTML = '<li class="online-user">Kimse yok</li>';
            } else {
                onlineList.innerHTML = html;
            }
        }
    }
});
// YENİ (DOĞRU)
window.socket.on('user typing', (data) => {
    const username = data.username || data; // data object veya string olabilir
    console.log('📢 Yazıyor:', username);
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.textContent = `${username} yazıyor...`;
        typingIndicator.style.display = 'block';
    }
});

window.socket.on('user stop typing', (data) => {
    const username = data.username || data;
    console.log('⏹️ Yazmayı bıraktı:', username);
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
});

    // Geçmiş özel mesajları yükle
    window.socket.on("load private messages", (messages) => {
        if (dmMessages) {
            dmMessages.innerHTML = '';
            messages.forEach(msg => addPrivateMessage(msg));
        }
    });
window.socket.on('user typing', (username) => {
    console.log('📢 Yazıyor:', username);
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.textContent = `${username} yazıyor...`;
        typingIndicator.style.display = 'block';
    }
});

window.socket.on('user stop typing', (username) => {
    console.log('⏹️ Yazmayı bıraktı:', username);
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
});

 // ========== MESAJ EKLEME FONKSİYONU ==========
window.addMessageToChat = function(msg) {
    if (!msg || !msg._id) return;
    
    const div = document.createElement("div");
    div.className = `message ${msg.username === localStorage.getItem("username") ? 'my-message' : 'other-message'}`;
    div.setAttribute('data-message-id', msg._id);
    div.setAttribute('data-view-once', msg.viewOnce === true ? 'true' : 'false');
    
    const avatarUrl = msg.avatar || `https://ui-avatars.com/api/?name=${msg.username}&background=3b82f6&color=fff&bold=true`;
    const time = new Date(msg.createdAt || msg.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    let html = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
            <strong style="font-size: 13px;">${msg.username}</strong>
        </div>
        <div style="margin-left: 32px;">
    `;
    
    if (msg.quoteTo) {
        html += `<div class="quoted-message" onclick="scrollToMessage('${msg.quoteTo.messageId}')"><div class="quoted-message-header">📝 Alıntı: <strong>${msg.quoteTo.username}</strong></div><div class="quoted-message-content">${(msg.quoteTo.message || '').substring(0, 80) || (msg.quoteTo.fileUrl ? '📎 Dosya' : '')}</div></div>`;
    }
    
    if (msg.replyTo) {
        html += `<div class="replied-message" onclick="scrollToMessage('${msg.replyTo.messageId}')"><div class="replied-message-header">💬 Yanıt: <strong>${msg.replyTo.username}</strong></div><div class="replied-message-content">${(msg.replyTo.message || '').substring(0, 50) || (msg.replyTo.fileUrl ? '📎 Dosya' : '')}</div></div>`;
    }
    

    // ========== TEK GÖRÜNÜMLÜK KONTROLÜ ==========
    const currentUser = localStorage.getItem("username");
    if (msg.viewOnce === true && msg.username !== currentUser) {
        // Başkasının tek görünümlük mesajı
        if (msg.fileUrl && msg.fileType && msg.fileType.startsWith('image/')) {
            const fullUrl = msg.fileUrl.startsWith('http') ? msg.fileUrl : `http://localhost:3000${msg.fileUrl}`;
            html += `
                <div style="margin: 8px 0;">
                    <div onclick="viewOnceMessage('${msg._id}', '${fullUrl}')" 
                         style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 20px; text-align: center; cursor: pointer;">
                        <div style="font-size: 40px;">📸</div>
                        <div style="font-weight: bold; color: #f59e0b;">Tek Görünümlük Resim</div>
                        <div style="font-size: 11px; color: #94a3b8;">Görüntülemek için tıkla</div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div style="margin: 8px 0;">
                    <div onclick="viewOnceMessage('${msg._id}', null)" 
                         style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #f59e0b; border-radius: 16px; padding: 20px; text-align: center; cursor: pointer;">
                        <div style="font-size: 40px;">👁️‍🗨️</div>
                        <div style="font-weight: bold; color: #f59e0b;">Tek Görünümlük Mesaj</div>
                        <div style="font-size: 11px; color: #94a3b8;">Görüntülemek için tıkla</div>
                    </div>
                </div>
            `;
        }
    } else {
        // NORMAL MESAJ GÖSTERİMİ
        if (msg.message) html += `<div style="margin-bottom: 5px;">${msg.message}</div>`;
        
        if (msg.fileUrl) {
            const fileName = msg.fileName || 'Dosya';
            const fileSize = msg.fileSize ? window.formatFileSize(msg.fileSize) : '';
            const fullUrl = msg.fileUrl.startsWith('http') ? msg.fileUrl : `http://localhost:3000${msg.fileUrl}`;
            
            if (msg.fileType && msg.fileType.startsWith('image/')) {
                html += `<div style="margin: 8px 0;"><img src="${fullUrl}" style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;" onclick="window.open('${fullUrl}', '_blank')"><div style="font-size: 11px;">${fileName} (${fileSize})</div></div>`;
            } else {
                html += `<div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #0f172a; border-radius: 8px;"><span>📎</span><div><div>${fileName}</div><div style="font-size: 10px;">${fileSize}</div></div><a href="${fullUrl}" download style="color: #3b82f6;">⬇️</a></div>`;
            }
        }
    }
    
    if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        html += `<div class="message-reactions">`;
        Object.entries(msg.reactions).forEach(([reaction, users]) => {
            html += `<button class="reaction-btn" onclick="addReaction('${msg._id}', '${reaction}')">${reaction} ${users.length}</button>`;
        });
        html += `</div>`;
    }
    
    html += `
        <div style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap;">
            <button class="reaction-btn" onclick="addReaction('${msg._id}', '👍')">👍</button>
            <button class="reaction-btn" onclick="addReaction('${msg._id}', '❤️')">❤️</button>
            <button class="reaction-btn" onclick="addReaction('${msg._id}', '😂')">😂</button>
            <button class="reaction-btn" onclick="replyToMessage('${msg._id}', '${msg.username}', '${(msg.message || '').replace(/'/g, "\\'")}', '${msg.fileUrl || ''}', '${msg.fileName || ''}')">💬 Yanıtla</button>
            <button class="reaction-btn" onclick="quoteMessage('${msg._id}', '${msg.username}', '${(msg.message || '').replace(/'/g, "\\'")}', '${msg.fileUrl || ''}', '${msg.fileName || ''}')">📝 Alıntı Yap</button>
            <button id="star-btn-${msg._id}" onclick="toggleStar('${msg._id}', this)" style="background:transparent; border:none; cursor:pointer;">☆</button>
    `;
    // 🟢 BUNU EKLE
if (msg.username === localStorage.getItem("username")) {
    html += `<button onclick="editMessage('${msg._id}', '${(msg.message || '').replace(/'/g, "\\'")}')" style="background:transparent; border:none; cursor:pointer; font-size:14px;">✏️</button>`;
}
// 🟢 SİLME BUTONU - BURAYA EKLE
if (msg.username === localStorage.getItem("username")) {
    html += `<button onclick="deleteMessage('${msg._id}')" style="background:transparent; border:none; cursor:pointer; font-size:14px;" title="Sil">🗑️</button>`;
}

    const userRole = localStorage.getItem('role');
    if (userRole === 'admin' || userRole === 'moderator') {
        html += `<button onclick="togglePin('${msg._id}', '${msg.room}', this)" style="background:transparent; border:none; cursor:pointer;">${msg.isPinned ? '📌' : '📍'}</button>`;
    }
    
    html += `</div>`;
    html += `<div class="message-time">${time}</div>`;
    html += `</div>`;
    
    div.innerHTML = html;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    setTimeout(() => {
        const starBtn = document.getElementById(`star-btn-${msg._id}`);
        if (starBtn) window.checkStarStatus(msg._id, starBtn);
    }, 100);
};
  window.sendMessage = async function() {
    const message = messageInput.value.trim();
    if (!message && !selectedFile) return;
    if (!window.socket?.connected) {
        alert('Sunucu bağlantısı kopuk!');
        return;
    }
    
    let fileData = null;
    if (selectedFile) {
        fileData = await window.uploadFile(selectedFile);
        if (!fileData) return;
    }
     const viewOnceValue = window.viewOnceActive === true;
    console.log('📸 Gönderilecek viewOnce değeri:', viewOnceValue);

    const messageData = {
        message: message,
        room: window.currentRoom,
        fileUrl: fileData?.url || null,
        fileName: fileData?.name || null,
        fileType: fileData?.type || null,
        fileSize: fileData?.size || null,
        viewOnce: viewOnceValue, 
        replyTo: replyingTo,
        quoteTo: quotingMessage  // 🟢 YENİ - Alıntı bilgisi
    };

    console.log('📤 Gönderilen veri:', messageData);
    window.socket.emit('chat message', messageData);
    
    // Temizlik
    messageInput.value = "";
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (filePreview) filePreview.style.display = 'none';
    window.viewOnceActive = false;
    if (viewOnceBtn) viewOnceBtn.classList.remove('active');
    if (typeof cancelReply === 'function') cancelReply();
    if (typeof cancelQuote === 'function') cancelQuote();  // 🟢 Alıntıyı temizle
};
    
    window.uploadFile = async function(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            return res.ok ? data.file : null;
        } catch (err) {
            alert('Dosya yüklenirken hata oluştu!');
            return null;
        }
    };
    // ========== MESAJ DÜZENLEME FONKSİYONU ==========
window.editMessage = function(messageId, oldMessage) {
    console.log("✏️ Düzenleme başlatıldı - Mesaj ID:", messageId);
    
    const newMessage = prompt("Mesajı düzenleyin:", oldMessage);
    
    if (!newMessage || newMessage.trim() === oldMessage) {
        console.log("Değişiklik yapılmadı veya iptal edildi");
        return;
    }
    
    if (window.socket && window.socket.connected) {
        window.socket.emit("edit message", {
            messageId: messageId,
            newMessage: newMessage.trim()
        });
        console.log("✏️ Düzenleme isteği gönderildi!");
    } else {
        alert("Bağlantı hatası! Lütfen sayfayı yenileyin.");
    }
};

// ========== MESAJ DÜZENLENDİ EVENTİ ==========
window.socket.on("message edited", (data) => {
    console.log("✏️ MESAJ DÜZENLENDİ:", data.id);
    
    const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
    if (!messageDiv) return;
    
    // Mesaj içeriğini bul ve güncelle
    const textDiv = messageDiv.querySelector('div[style*="margin-left: 32px;"] div:first-child');
    if (textDiv && textDiv.textContent) {
        textDiv.textContent = data.newMessage;
    }
    
    // Düzenlendi ibaresi ekle
    if (!messageDiv.querySelector('.edited-badge')) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'edited-badge';
        editedSpan.textContent = '(düzenlendi)';
        editedSpan.style.fontSize = '10px';
        editedSpan.style.marginLeft = '5px';
        const timeDiv = messageDiv.querySelector('.message-time');
        if (timeDiv) timeDiv.before(editedSpan);
    }
});
    // ========== MESAJ SİLİNDİ EVENTİ ==========
window.socket.on("message deleted", (data) => {
    console.log("🗑️ SİLİNDİ BİLDİRİMİ GELDİ:", data.id);
    
    const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
    if (messageDiv) {
        messageDiv.remove();
        console.log("✅ Mesaj DOM'dan kaldırıldı:", data.id);
    } else {
        console.log("❌ Mesaj DOM'da bulunamadı:", data.id);
    }
});
   // ========== BUTON OLAYLARI ==========
sendBtn.addEventListener('click', (e) => { e.preventDefault(); window.sendMessage(); });
messageInput.addEventListener('keypress', (e) => { if (e.key === "Enter") { e.preventDefault(); window.sendMessage(); } });
logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = "/login.html"; });

// View Once butonu
if (viewOnceBtn) {
    viewOnceBtn.addEventListener('click', () => {
        window.viewOnceActive = !window.viewOnceActive;
        if (window.viewOnceActive) {
            viewOnceBtn.style.backgroundColor = '#f59e0b';
            console.log('📸 Tek görünürlük AKTİF - değer:', window.viewOnceActive);
        } else {
            viewOnceBtn.style.backgroundColor = '#334155';
            console.log('📸 Tek görünürlük PASİF - değer:', window.viewOnceActive);
        }
    });
}
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { alert('Dosya boyutu 5MB\'dan büyük olamaz!'); return; }
            selectedFile = file;
            if (fileName) fileName.textContent = file.name;
            if (fileSizeSpan) fileSizeSpan.textContent = window.formatFileSize(file.size);
            if (filePreview) filePreview.style.display = 'flex';
        });
        if (cancelFileBtn) {
            cancelFileBtn.addEventListener('click', () => { selectedFile = null; fileInput.value = ''; if (filePreview) filePreview.style.display = 'none'; });
        }
    }
    
    // ========== ODA DEĞİŞTİR ==========
    if (roomSelect) {
        roomSelect.onchange = () => {
            window.currentRoom = roomSelect.value;
            window.socket.emit("join room", window.currentRoom);
            chatBox.innerHTML = "";
            if (typeof window.loadPinnedMessages === 'function') window.loadPinnedMessages(window.currentRoom);
        };
    }
    
    // ========== SAYFA YÜKLENİNCE ==========
    fetch('/api/messages?room=general')
        .then(res => res.json())
        .then(messages => {
            chatBox.innerHTML = '';
            messages.forEach(msg => window.addMessageToChat(msg));
            if (typeof window.loadPinnedMessages === 'function') window.loadPinnedMessages('general');
        })
        .catch(err => console.error('❌ Mesaj yükleme hatası:', err));

    // URL'den message parametresini al ve mesaja kaydır
const urlParams = new URLSearchParams(window.location.search);
const messageId = urlParams.get('message');
if (messageId) {
    setTimeout(() => {
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
            setTimeout(() => {
                messageDiv.style.backgroundColor = '';
            }, 3000);
        }
    }, 1000);
}
    // ========== EMOJİ PANELİ ==========
    if (emojiBtn && emojiPanel) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPanel.style.display = emojiPanel.style.display === 'flex' ? 'none' : 'flex';
            if (emojiPanel.style.display === 'flex') window.loadEmojis('recent');
        });
    }
      // Emoji veritabanı//
window.emojiDB = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃'],
    people: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐸', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'],
    food: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍤', '🥟', '🦪', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🧉', '🧊', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🏵', '🎗', '🎫', '🎟', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰'],
    travel: ['✈️', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺', '🏖', '🏝', '🏜', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺', '🛖', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏛', '⛪', '🕌', '🛕', '🕍', '⛩', '🕋'],
    objects: ['💡', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '🧱', '⛓', '🔫', '💣', '🧨', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '💈', '🔭', '🔬', '🕳', '💊', '💉'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮', '✝', '☪', '🕉', '☸', '✡', '🔯', '🕎', '☯', '☦', '🛐', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛', '🉑', '☢', '☣', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️'],
    flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇹🇷', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇵🇹', '🇳🇱', '🇧🇪', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇮🇸', '🇮🇪', '🇨🇭', '🇦🇹', '🇬🇷', '🇵🇱', '🇨🇿', '🇭🇺', '🇷🇴', '🇧🇬', '🇷🇺', '🇺🇦', '🇨🇳', '🇯🇵', '🇰🇷', '🇮🇳', '🇧🇷', '🇲🇽', '🇨🇦', '🇦🇺', '🇳🇿']
};

    window.recentEmojis = JSON.parse(localStorage.getItem('recentEmojis')) || [];
    
    window.loadEmojis = function(category, searchTerm = '') {
        let emojisToShow = [];
        if (category === 'recent') emojisToShow = window.recentEmojis;
        else emojisToShow = window.emojiDB[category] || [];
        if (searchTerm) emojisToShow = Object.values(window.emojiDB).flat().filter(e => e.includes(searchTerm));
        if (!emojiContent) return;
        emojiContent.innerHTML = '';
        if (emojisToShow.length === 0) { emojiContent.innerHTML = '<div style="text-align:center;">Emoji bulunamadı</div>'; return; }
        emojisToShow.forEach(emoji => {
            const div = document.createElement('div');
            div.className = 'emoji-item';
            div.textContent = emoji;
            div.onclick = () => window.insertEmoji(emoji);
            emojiContent.appendChild(div);
        });
    };
    
    window.insertEmoji = function(emoji) {
        messageInput.value += emoji;
        messageInput.focus();
        if (!window.recentEmojis.includes(emoji)) {
            window.recentEmojis.unshift(emoji);
            if (window.recentEmojis.length > 30) window.recentEmojis.pop();
            localStorage.setItem('recentEmojis', JSON.stringify(window.recentEmojis));
        }
    };
    
    if (emojiTabs.length) {
        emojiTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                emojiTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                window.loadEmojis(tab.dataset.category, emojiSearch?.value || '');
            });
        });
    }
    if (emojiSearch) {
        emojiSearch.addEventListener('input', (e) => {
            const active = document.querySelector('.emoji-tab.active');
            window.loadEmojis(active?.dataset.category || 'recent', e.target.value);
        });
    }
    document.addEventListener('click', (e) => {
        if (emojiBtn && emojiPanel && !emojiBtn.contains(e.target) && !emojiPanel.contains(e.target)) {
            emojiPanel.style.display = 'none';
        }
    });
    window.loadEmojis('recent');
    
    // ========== YILDIZLAMA FONKSİYONLARI ==========
    window.toggleStar = async function(messageId, buttonElement) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/messages/${messageId}/star`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && buttonElement) {
                buttonElement.innerHTML = data.isStarred ? '⭐' : '☆';
                buttonElement.style.color = data.isStarred ? '#f59e0b' : '#94a3b8';
            }
        } catch (err) { console.error('Yıldızlama hatası:', err); }
    };
    
    window.checkStarStatus = async function(messageId, buttonElement) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/messages/${messageId}/is-starred`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (buttonElement) {
                buttonElement.innerHTML = data.isStarred ? '⭐' : '☆';
                buttonElement.style.color = data.isStarred ? '#f59e0b' : '#94a3b8';
            }
        } catch (err) { console.error('Durum kontrol hatası:', err); }
    };

    // ========== SABİTLEME FONKSİYONLARI ==========
    window.loadPinnedMessages = async function(room) {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`/api/rooms/${room}/pinned-messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const messages = await res.json();
                updatePinnedPanel(messages);
            }
        } catch (err) { console.error('Sabitlenmiş mesajlar yüklenemedi:', err); }
    };
    
    function updatePinnedPanel(messages) {
        let pinnedPanel = document.getElementById('pinnedMessagesPanel');
        if (!pinnedPanel) {
            pinnedPanel = document.createElement('div');
            pinnedPanel.id = 'pinnedMessagesPanel';
            pinnedPanel.className = 'pinned-messages-panel';
            const chatCard = document.querySelector('.chat-card');
            if (chatCard) chatCard.insertBefore(pinnedPanel, chatCard.firstChild);
        }
        if (!messages || messages.length === 0) { if (pinnedPanel) pinnedPanel.style.display = 'none'; return; }
        pinnedPanel.style.display = 'block';
        let html = `<div class="pinned-header"><span>📌 Sabitlenmiş Mesajlar (${messages.length})</span><button class="close-pinned-btn" onclick="window.togglePinnedPanel()">✕</button></div><div class="pinned-list">`;
        messages.forEach(msg => {
            const time = new Date(msg.pinnedAt || msg.createdAt).toLocaleString('tr-TR');
            html += `<div class="pinned-item" onclick="scrollToMessage('${msg._id}')"><div class="pinned-item-header"><strong>${msg.username}</strong><span>${time}</span></div><div class="pinned-item-content">${msg.message || (msg.fileUrl ? '📎 Dosya' : '')}</div><div class="pinned-item-footer"><button class="unpin-btn" onclick="event.stopPropagation(); togglePin('${msg._id}', '${window.currentRoom}', this)">Sabiti Kaldır</button></div></div>`;
        });
        html += `</div>`;
        pinnedPanel.innerHTML = html;
    }
    
    window.togglePinnedPanel = function() {
        const panel = document.getElementById('pinnedMessagesPanel');
        if (panel) {
            const list = panel.querySelector('.pinned-list');
            if (list) list.style.display = list.style.display === 'none' ? 'block' : 'none';
        }
    };
    
    window.togglePin = async function(messageId, room, buttonElement) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/messages/${messageId}/pin`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ room })
            });
            const data = await res.json();
            if (res.ok) {
                if (buttonElement) {
                    buttonElement.innerHTML = data.isPinned ? '📌' : '📍';
                    buttonElement.style.color = data.isPinned ? '#f59e0b' : '#94a3b8';
                }
                window.loadPinnedMessages(room);
                alert(data.message);
            }
        } catch (err) { console.error('Sabitleme hatası:', err); }
    };
    
    // ========== ENGELLEME FONKSİYONLARI ==========
    window.toggleBlock = async function(username, buttonElement) {
        if (username === localStorage.getItem("username")) { alert("Kendinizi engelleyemezsiniz!"); return; }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/users/${username}/block`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && buttonElement) {
                if (data.isBlocked) {
                    buttonElement.innerHTML = '🔴 Engellendi';
                    buttonElement.style.backgroundColor = '#ef4444';
                    buttonElement.style.color = 'white';
                } else {
                    buttonElement.innerHTML = '🚫 Engelle';
                    buttonElement.style.backgroundColor = 'transparent';
                    buttonElement.style.color = '#94a3b8';
                }
                alert(data.message);
            }
        } catch (err) { console.error('Engelleme hatası:', err); }
    };
    
    window.checkBlockStatus = async function(username) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/users/${username}/is-blocked`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            return data.isBlocked;
        } catch (err) { return false; }
    };
    
    // ========== MESAJ YANITLAMA ==========
    window.replyToMessage = function(messageId, username, message, fileUrl, fileName) {
        replyingTo = { messageId, username, message: message || '', fileUrl: fileUrl || null, fileName: fileName || null };
        showReplyPreview();
    };
    
    function showReplyPreview() {
        if (!replyingTo) return;
        if (replyPreview) replyPreview.remove();
        replyPreview = document.createElement('div');
        replyPreview.className = 'reply-preview';
        replyPreview.innerHTML = `<div class="reply-preview-content"><div class="reply-preview-header"><span>💬 Yanıtlanıyor: <strong>${replyingTo.username}</strong></span><button class="cancel-reply-btn" onclick="cancelReply()">✕</button></div><div class="reply-preview-message">${replyingTo.message?.substring(0, 50) || (replyingTo.fileUrl ? '📎 Dosya' : '')}</div></div>`;
        const chatBottom = document.querySelector('.chat-bottom');
        if (chatBottom) chatBottom.parentNode.insertBefore(replyPreview, chatBottom);
    }
    
    window.cancelReply = function() {
        replyingTo = null;
        if (replyPreview) { replyPreview.remove(); replyPreview = null; }
    };
     // ===================== ALINTI YAPMA =====================
let quotingMessage = null;  // Alıntılanan mesaj bilgisi
let quotePreview = null;    // Alıntı önizleme elementi

// Mesajı alıntıla
window.quoteMessage = function(messageId, username, message, fileUrl, fileName) {
    console.log('📝 Alıntılanıyor:', { messageId, username, message });
    
    quotingMessage = {
        messageId: messageId,
        username: username,
        message: message || '',
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    
    // Önizleme göster
    showQuotePreview();
};

// Alıntı önizlemesini göster
function showQuotePreview() {
    if (!quotingMessage) return;
    
    // Eski önizlemeyi kaldır
    if (quotePreview) {
        quotePreview.remove();
    }
    
    quotePreview = document.createElement('div');
    quotePreview.className = 'quote-preview';
    
    let content = `
        <div class="quote-preview-content">
            <div class="quote-preview-header">
                <span>📝 Alıntılanıyor: <strong>${quotingMessage.username}</strong></span>
                <button class="cancel-quote-btn" onclick="cancelQuote()">✕</button>
            </div>
            <div class="quote-preview-message">
    `;
    
    if (quotingMessage.fileUrl) {
        if (quotingMessage.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            content += `<span>📷 Resim: ${quotingMessage.fileName || 'Resim'}</span>`;
        } else {
            content += `<span>📎 Dosya: ${quotingMessage.fileName || 'Dosya'}</span>`;
        }
    } else if (quotingMessage.message) {
        content += `<span>${quotingMessage.message.substring(0, 80)}${quotingMessage.message.length > 80 ? '...' : ''}</span>`;
    } else {
        content += `<span>Mesaj</span>`;
    }
    
    content += `
            </div>
        </div>
    `;
    
    quotePreview.innerHTML = content;
    
    // Input'un üstüne ekle
    const chatBottom = document.querySelector('.chat-bottom');
    if (chatBottom) {
        chatBottom.parentNode.insertBefore(quotePreview, chatBottom);
    }
}

// Alıntıyı iptal et
window.cancelQuote = function() {
    quotingMessage = null;
    if (quotePreview) {
        quotePreview.remove();
        quotePreview = null;
    }
};
    // ========== SCROLL OLAYI ==========
    function checkVisibleMessages() {
        if (readTimeout) clearTimeout(readTimeout);
        readTimeout = setTimeout(() => {
            const messages = document.querySelectorAll('.message:not(.my-message)');
            const newVisibleIds = new Set();
            messages.forEach(msg => {
                const rect = msg.getBoundingClientRect();
                const chatBoxRect = chatBox.getBoundingClientRect();
                if (rect.top < chatBoxRect.bottom && rect.bottom > chatBoxRect.top) {
                    const messageId = msg.dataset.messageId;
                    if (messageId && !visibleMessageIds.has(messageId)) newVisibleIds.add(messageId);
                }
            });
            if (newVisibleIds.size > 0) {
                window.socket.emit("mark as read", { messageIds: Array.from(newVisibleIds), room: window.currentRoom });
                newVisibleIds.forEach(id => visibleMessageIds.add(id));
            }
        }, 500);
    }
    
    chatBox.addEventListener('scroll', checkVisibleMessages);
    
   
    // ========== DİĞER ==========
    window.showUserProfile = function(username) { window.location.href = `/profile.html?user=${username}`; };
    window.startPrivateChat = function(targetUser) { openPrivateChat(targetUser); };
});
    // ========== ÖZEL MESAJLAŞMA (DM) ==========
    let currentDmUser = null;
    let currentDmRoom = null;
    let dmSelectedFile = null;

    // DM panel elementleri
    const dmPanel = document.getElementById('dmPanel');
    const dmUsername = document.getElementById('dmUsername');
    const dmMessages = document.getElementById('dmMessages');
    const dmInput = document.getElementById('dmInput');
    const dmSendBtn = document.getElementById('dmSendBtn');
    const closeDmBtn = document.getElementById('closeDmBtn');
    const dmEmojiBtn = document.getElementById('dmEmojiBtn');
    const dmFileBtn = document.getElementById('dmFileBtn');
    const dmEmojiPanel = document.getElementById('dmEmojiPanel');
    const dmEmojiContent = document.getElementById('dmEmojiContent');
    const dmEmojiSearch = document.getElementById('dmEmojiSearch');

    // DM panelini aç
    window.openPrivateChat = function(targetUser) {
        if (targetUser === localStorage.getItem("username")) {
            alert("Kendinizle sohbet başlatamazsınız!");
            return;
        }
        
        currentDmUser = targetUser;
        
        // Oda ID'si oluştur
        const users = [localStorage.getItem("username"), targetUser].sort();
        currentDmRoom = `dm_${users[0]}_${users[1]}`;
        
        // Panel başlığını güncelle
        if (dmUsername) dmUsername.textContent = `💌 ${targetUser}`;
        
        // Özel odaya katıl
        window.socket.emit("join private room", { targetUser });
        
        // Paneli göster
        if (dmPanel) dmPanel.style.display = 'flex';
    };

    // DM panelini kapat
    if (closeDmBtn) {
        closeDmBtn.addEventListener('click', () => {
            if (dmPanel) dmPanel.style.display = 'none';
            currentDmUser = null;
            currentDmRoom = null;
        });
    }
  
    // Özel mesaj ekle
    function addPrivateMessage(msg) {
        if (!dmMessages) return;
        
        const div = document.createElement('div');
        div.className = `dm-message ${msg.sender === localStorage.getItem("username") ? 'sent' : 'received'}`;
        
        const time = new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let content = '';
        
        if (msg.message) {
            content += `<div>${msg.message}</div>`;
        }
        
        if (msg.fileUrl) {
            const fileName = msg.fileName || 'Dosya';
            const fileSize = msg.fileSize ? window.formatFileSize(msg.fileSize) : '';
            const fullUrl = msg.fileUrl.startsWith('http') ? msg.fileUrl : `http://localhost:3000${msg.fileUrl}`;
            
            if (msg.fileType && msg.fileType.startsWith('image/')) {
                content += `
                    <div style="margin: 5px 0;">
                        <img src="${fullUrl}" style="max-width: 150px; max-height: 150px; border-radius: 8px; cursor: pointer;" 
                             onclick="window.open('${fullUrl}')">
                        <div style="font-size: 10px; opacity: 0.7;">${fileName}</div>
                    </div>
                `;
            } else {
                content += `
                    <div style="display: flex; align-items: center; gap: 5px; margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 5px;">
                        <span>📎</span>
                        <span style="flex:1; font-size: 11px;">${fileName}</span>
                        <a href="${fullUrl}" download style="color: #3b82f6; text-decoration: none;">⬇️</a>
                    </div>
                `;
            }
        }
        
        content += `<div class="dm-message-time">${time}</div>`;
        
        div.innerHTML = content;
        dmMessages.appendChild(div);
        dmMessages.scrollTop = dmMessages.scrollHeight;
    }

    // DM mesajı gönder
    if (dmSendBtn) {
        dmSendBtn.addEventListener('click', sendDmMessage);
    }
    if (dmInput) {
        dmInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendDmMessage();
        });
    }

    async function sendDmMessage() {
        const message = dmInput ? dmInput.value.trim() : '';
        
        if (!message && !dmSelectedFile) return;
        
        let fileData = null;
        
        if (dmSelectedFile) {
            fileData = await window.uploadFile(dmSelectedFile);
            if (!fileData) return;
        }
        
        window.socket.emit("private message", {
            receiver: currentDmUser,
            message: message || '',
            roomId: currentDmRoom,
            fileUrl: fileData?.url || null,
            fileName: fileData?.name || null,
            fileType: fileData?.type || null,
            fileSize: fileData?.size || null
        });
        
        if (dmInput) dmInput.value = '';
        dmSelectedFile = null;
    }

    // DM emoji paneli
    if (dmEmojiBtn) {
        dmEmojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dmEmojiPanel) {
                dmEmojiPanel.style.display = dmEmojiPanel.style.display === 'none' ? 'flex' : 'none';
                if (dmEmojiPanel.style.display === 'flex') {
                    loadDmEmojis('recent');
                }
            }
        });
    }

    function loadDmEmojis(category, searchTerm = '') {
        let emojisToShow = [];
        
        if (category === 'recent') {
            emojisToShow = window.recentEmojis || [];
        } else {
            emojisToShow = window.emojiDB[category] || [];
        }
        
        if (searchTerm) {
            const allEmojis = Object.values(window.emojiDB).flat();
            emojisToShow = allEmojis.filter(emoji => emoji.includes(searchTerm));
        }
        
        if (dmEmojiContent) {
            dmEmojiContent.innerHTML = '';
            
            emojisToShow.forEach(emoji => {
                const div = document.createElement('div');
                div.className = 'emoji-item';
                div.textContent = emoji;
                div.onclick = () => {
                    if (dmInput) dmInput.value += emoji;
                    if (dmInput) dmInput.focus();
                    if (dmEmojiPanel) dmEmojiPanel.style.display = 'none';
                };
                dmEmojiContent.appendChild(div);
            });
        }
    }

    // DM emoji arama
    if (dmEmojiSearch) {
        dmEmojiSearch.addEventListener('input', (e) => {
            loadDmEmojis('recent', e.target.value);
        });
    }

    // ========== TEK GÖRÜNÜRLÜK MESAJ GÖRÜNTÜLEME ==========
  window.viewOnceMessage = function(messageId, imageUrl) {
    console.log('📸 Tek görünürlük mesaj görüntüleniyor:', messageId);
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        flex-direction: column;
        cursor: pointer;
    `;
    
    if (imageUrl) {
        modal.innerHTML = `
            <img src="${imageUrl}" style="max-width: 90%; max-height: 90%; border-radius: 10px;">
            <div style="margin-top: 20px; color: white; background: rgba(0,0,0,0.7); padding: 8px 20px; border-radius: 30px; font-size: 14px;">
                ⚠️ Bu içerik 5 saniye sonra silinecek
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div style="background: #1e293b; padding: 30px; border-radius: 20px; text-align: center;">
                <div style="font-size: 50px;">👁️‍🗨️</div>
                <div style="margin-top: 20px; font-size: 18px;">Tek görünümlük mesaj</div>
                <div style="margin-top: 10px; font-size: 14px; opacity: 0.7;">Bu mesaj 5 saniye sonra silinecek</div>
            </div>
        `;
    }
    
    document.body.appendChild(modal);
    
    // Tıklayınca kapat
    modal.onclick = () => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
    };
    
    // Sunucuya görüntülendiğini bildir
    if (window.socket) {
        window.socket.emit("view once message", { messageId });
    }
    
    // 5 saniye sonra modalı ve mesajı kaldır
    setTimeout(() => {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
        // Mesajı DOM'dan kaldır
        const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    }, 5000);
};
// ========== MESAJ SİLME ==========
window.deleteMessage = function(messageId) {
    if (!confirm('Bu mesajı silmek istediğine emin misin?')) return;
    if (window.socket) {
        window.socket.emit("delete message", messageId);
    }
};
// ========== YAZIYOR BİLDİRİMLERİ ==========
let typingTimeout;

messageInput.addEventListener('input', () => {
    if (typingTimeout) clearTimeout(typingTimeout);
    
    window.socket.emit('typing', { 
        room: window.currentRoom, 
        username: localStorage.getItem("username") 
    });
    
    typingTimeout = setTimeout(() => {
        window.socket.emit('stop typing', { 
            room: window.currentRoom, 
            username: localStorage.getItem("username") 
        });
    }, 1000);
});


    // ========== TÜM RESİMLERİ TIKLANABİLİR YAP ==========
    setInterval(() => {
        document.querySelectorAll('.message img').forEach(img => {
            if (!img.hasAttribute('data-fixed')) {
                img.setAttribute('data-fixed', 'true');
                img.style.cursor = 'pointer';
                img.onclick = () => window.open(img.src, '_blank');
            }
        });
    }, 1000);