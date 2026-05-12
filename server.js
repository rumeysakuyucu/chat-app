const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require('dotenv').config();

const User = require("./models/User");
const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;
// ===================== AUTH MIDDLEWARE =====================
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ message: "Token bulunamadı!" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Geçersiz token!" });
    }
};

// Server başlatılırken çalıştır
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chatdb")
    .then(() => {
        console.log("✅ MongoDB bağlandı");
        createDefaultRooms();
    })
    .catch(err => console.log("❌ MongoDB hatası:", err));

    // ===================== KULLANICI ENGELLEME TEST ROUTE =====================
app.get('/api/users/blocked', authMiddleware, async (req, res) => {
    try {
        console.log("🔥 BLOCKED ROUTE ÇALIŞTI - User:", req.user.username);
        const user = await User.findById(req.user.id);
        const blockedUsers = await User.find({
            username: { $in: user.blockedUsers }
        }).select('username avatar bio lastSeen isOnline');
        res.json(blockedUsers);
    } catch (err) {
        console.error('Hata:', err);
        res.status(500).json({ message: 'Liste alınamadı' });
    }
});

    // ===================== YILDIZLI MESAJLAR (GEÇİCİ - TEST) =====================
app.get('/api/users/starred-messages', authMiddleware, async (req, res) => {
    try {
        console.log('📌 TEST: Yıldızlı mesajlar isteği geldi');
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
        const messages = await Message.find({
            _id: { $in: user.starredMessages }
        });
        console.log('📌 Bulunan mesaj sayısı:', messages.length);
        res.json(messages);
    } catch (err) {
        console.error('❌ Hata:', err);
        res.status(500).json({ message: 'Mesajlar alınamadı' });
    }
});

app.post('/api/messages/:messageId/star', authMiddleware, async (req, res) => {
    try {
        console.log('📌 TEST: Yıldızlama isteği geldi');
        const { messageId } = req.params;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        const isStarred = user.starredMessages.includes(messageId);
        if (isStarred) {
            user.starredMessages = user.starredMessages.filter(id => id !== messageId);
        } else {
            user.starredMessages.push(messageId);
        }
        await user.save();
        res.json({ isStarred: !isStarred });
    } catch (err) {
        console.error('❌ Hata:', err);
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});

app.get('/api/messages/:messageId/is-starred', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const user = await User.findById(req.user.id);
        res.json({ isStarred: user.starredMessages.includes(messageId) });
    } catch (err) {
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});
// ===================== DOSYA YÜKLEME =====================
const multer = require('multer');
const fs = require('fs');

// Uploads klasörünü oluştur
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

// TÜM DOSYA TÜRLERİNE İZİN VER (resimler dahil)
const fileFilter = (req, file, cb) => {
    console.log('📁 Dosya yükleniyor:', file.originalname, 'Tür:', file.mimetype);
    cb(null, true); // Tüm dosyalara izin ver
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB'a çıkaralım (resimler için)
    fileFilter: fileFilter
});
// ===================== DOSYA YÜKLEME API =====================
app.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    console.log('✅ DOSYA YÜKLEME ROUTE ÇALIŞTI');
    
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Dosya yok' });
        }
        
        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.json({
            message: 'Dosya başarıyla yüklendi',
            file: {
                url: fileUrl,
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            }
        });
        
    } catch (err) {
        console.error('Hata:', err);
        res.status(500).json({ message: 'Hata oluştu' });
    }
});

// Statik dosyaları servis et
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// AI cevap dosyasını oku
let aiResponses = {};
try {
    const aiData = fs.readFileSync('./ai-responses.json', 'utf8');
    aiResponses = JSON.parse(aiData);
    console.log('✅ AI yanıtları yüklendi');
} catch (err) {
    console.log('❌ AI dosyası okunamadı:', err.message);
}

/* ===================== MIDDLEWARE ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use('/sounds', express.static(path.join(__dirname, 'public/sounds')));  // SES DOSYALARI

// İlk odaları oluştur
async function createDefaultRooms() {
    const Room = require("./models/Room");
    const defaultRooms = ['general'];
    
    for (const roomName of defaultRooms) {
        const existingRoom = await Room.findOne({ name: roomName });
        if (!existingRoom) {
            const room = new Room({
                name: roomName,
                description: `${roomName} sohbet odası`,
                createdBy: 'system',
                pinnedMessages: []
            });
            await room.save();
            console.log(`📌 Varsayılan oda oluşturuldu: ${roomName}`);
        }
    }
}

// ===================== YAPAY ZEKA (AI) =====================
app.post('/api/ai/ask', authMiddleware, async (req, res) => {
    try {
        const { question } = req.body;
        console.log('🤖 AI sorusu:', question);
        
        // Basit test cevabı
        const cevap = `Merhaba! "${question}" sorusunu sordun. Ben AI asistan.`;
        
        res.json({ answer: cevap });
        
    } catch (err) {
        console.error('AI hatası:', err);
        res.json({ answer: 'Bir hata oluştu.' });
    }
});
// ... diğer route'lar ...
/* ===================== ROUTES ===================== */
// Ana sayfa -> login'e yönlendir
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

// Chat sayfası
app.get("/chat", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
// KAYIT OL
app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Kullanıcı adı ve şifre gerekli!" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Şifre en az 6 karakter olmalı!" });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Bu kullanıcı adı zaten alınmış!" });
        }

        const newUser = new User({ username, password });
        await newUser.save();
        
        res.status(201).json({ message: "Kayıt başarılı!" });

    } catch (err) {
        console.error("Register hatası:", err);
        res.status(500).json({ message: "Sunucu hatası!" });
    }
});
// ===================== KULLANICI PROFİLİ ENDPOINT'LERİ =====================

// Profil bilgilerini getir (hali hazırda var)
app.get('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Profil bilgileri alınamadı' });
    }
});

// Hakkımda yazısını güncelle
app.put('/api/users/bio', authMiddleware, async (req, res) => {
    try {
        const { bio } = req.body;
        
        if (bio && bio.length > 150) {
            return res.status(400).json({ message: 'Hakkımda yazısı en fazla 150 karakter olabilir' });
        }
        
        await User.findByIdAndUpdate(req.user.id, { bio });
        
        res.json({ message: 'Hakkımda yazısı güncellendi', bio });
    } catch (err) {
        console.error('Bio güncelleme hatası:', err);
        res.status(500).json({ message: 'Güncelleme başarısız' });
    }
});

// Başka bir kullanıcının profilini getir
app.get('/api/users/:username', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username avatar bio lastSeen isOnline role');
        
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
        
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Profil bilgileri alınamadı' });
    }
});
// ===================== PROFİL RESMİ YÜKLEME =====================
app.post('/api/users/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        console.log('✅ PROFİL RESMİ YÜKLEME ÇALIŞTI');
        
        if (!req.file) {
            return res.status(400).json({ message: 'Dosya yüklenemedi' });
        }
        
        // Dosya boyutu kontrolü (1MB)
        if (req.file.size > 1 * 1024 * 1024) {
            return res.status(400).json({ message: 'Profil resmi 1MB\'dan büyük olamaz!' });
        }
        
        // Sadece resim dosyalarına izin ver
        if (!req.file.mimetype.startsWith('image/')) {
            return res.status(400).json({ message: 'Sadece resim dosyaları yüklenebilir!' });
        }
        
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        // Kullanıcının avatarını güncelle
        await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });
        
        res.json({
            message: 'Profil resmi başarıyla güncellendi',
            avatar: avatarUrl
        });
        
    } catch (err) {
        console.error('Profil resmi yükleme hatası:', err);
        res.status(500).json({ message: 'Profil resmi yüklenirken hata oluştu' });
    }
});

// Kullanıcı profil bilgilerini getir
app.get('/api/users/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Profil bilgileri alınamadı' });
    }
});
// GİRİŞ YAP
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Kullanıcı adı ve şifre gerekli!" });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı!" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Kullanıcı adı veya şifre hatalı!" });
        }

        // ✅ BURADAKİ expiresIn: "7d" YERİNE "30d" YAP
        const token = jwt.sign(
            { id: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: "30d" }  // 7d'den 30d'ye çevir
        );

        res.json({ token, username: user.username, role: user.role });

    } catch (err) {
        console.error("Login hatası:", err);
        res.status(500).json({ message: "Sunucu hatası!" });
    }
});
// MESAJLARI GETİR
app.get("/api/messages", async (req, res) => {
    try {
        const { room = "general" } = req.query;
        const messages = await Message.find({ room })
            .sort({ createdAt: -1 })  // Yeniden eskiye sırala
            .limit(500);
        
        // Sonra ters çevir ki ekranda eskiden yeniye görünsün
        res.json(messages.reverse());
    } catch (err) {
        console.error("Mesaj getirme hatası:", err);
        res.status(500).json({ message: "Sunucu hatası!" });
    }
});
// Rapor route'larını ekle
const reportRoutes = require('./routes/reports');
app.use('/api/reports', reportRoutes);
// Admin route'larını ekle
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);


// ===================== SABİTLENMİŞ MESAJLAR =====================

// Mesajı sabitle / sabiti kaldır
app.post('/api/messages/:messageId/pin', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { room } = req.body;
        
        // Admin veya moderator kontrolü
        if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
            return res.status(403).json({ message: 'Bu işlem için yetkiniz yok!' });
        }
        
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Mesaj bulunamadı' });
        }
        
        // Mesajın sabitlenme durumunu değiştir
        message.isPinned = !message.isPinned;
        
        if (message.isPinned) {
            message.pinnedBy = req.user.username;
            message.pinnedAt = new Date();
        } else {
            message.pinnedBy = null;
            message.pinnedAt = null;
        }
        
        await message.save();
        
        // Oda bilgilerini güncelle
        const Room = require('./models/Room');
        const roomDoc = await Room.findOne({ name: room });
        if (roomDoc) {
            if (message.isPinned) {
                if (!roomDoc.pinnedMessages.includes(messageId)) {
                    roomDoc.pinnedMessages.push(messageId);
                }
            } else {
                roomDoc.pinnedMessages = roomDoc.pinnedMessages.filter(id => id.toString() !== messageId);
            }
            await roomDoc.save();
        }
        
        res.json({ 
            message: message.isPinned ? 'Mesaj sabitlendi' : 'Mesaj sabitlenmesi kaldırıldı',
            isPinned: message.isPinned
        });
        
    } catch (err) {
        console.error('Sabitleme hatası:', err);
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});

// Odanın sabitlenmiş mesajlarını getir
app.get('/api/rooms/:room/pinned-messages', authMiddleware, async (req, res) => {
    try {
        const { room } = req.params;
        
        const messages = await Message.find({
            room: room,
            isPinned: true
        }).sort({ pinnedAt: -1 });
        
        res.json(messages);
        
    } catch (err) {
        console.error('Sabitlenmiş mesajlar getirme hatası:', err);
        res.status(500).json({ message: 'Mesajlar alınamadı' });
    }
});

// Odanın sabitlenmiş mesajlarını getir
app.get('/api/rooms/:room/pinned-messages', authMiddleware, async (req, res) => {
    try {
        const { room } = req.params;
        
        const messages = await Message.find({
            room: room,
            isPinned: true
        }).sort({ pinnedAt: -1 });
        
        res.json(messages);
        
    } catch (err) {
        console.error('Sabitlenmiş mesajlar getirme hatası:', err);
        res.status(500).json({ message: 'Mesajlar alınamadı' });
    }
});

// Tüm odaları getir (sabitlenmiş mesajlar için)
app.get('/api/rooms', authMiddleware, async (req, res) => {
    try {
        const rooms = await Room.find().sort({ createdAt: -1 });
        res.json(rooms);
    } catch (err) {
        console.error('Odalar getirme hatası:', err);
        res.status(500).json({ message: 'Odalar alınamadı' });
    }
});
/* ===================== SOCKET.JWT MIDDLEWARE ===================== */
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    console.log('🔍 Socket token kontrolü:', token ? 'Token var' : 'Token yok'); // TEST

    if (!token) {
        return next(new Error("Authentication error: Token missing"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        console.log('✅ Socket token doğrulandı:', decoded.username); // TEST
        next();
    } catch (err) {
        console.error('❌ Socket token hatası:', err.message); // TEST
        next(new Error("Authentication error: Invalid token"));
    }
});
/* ===================== SOCKET.IO OLAYLARI ===================== */
// ===================== ONLINE KULLANICILAR =====================
const onlineUsers = new Map();

io.on("connection", async (socket) => {
    console.log(`🟢 ${socket.user.username} bağlandı (${socket.id})`);
       /* ===================== ODAYA KATIL ===================== */
    socket.on("join room", async (room) => {
        try {
            // Önceki odalardan ayrıl
            const oldRooms = Array.from(socket.rooms);
            for (const r of oldRooms) {
                if (r !== socket.id) {
                    socket.leave(r);
                    if (onlineUsers.has(r)) {
                        onlineUsers.get(r).delete(socket.user.username);
                        io.to(r).emit("online users", Array.from(onlineUsers.get(r) || []));
                        console.log(`📌 ${socket.user.username} ${r} odasından ayrıldı. Kalan: ${Array.from(onlineUsers.get(r) || []).join(', ') || 'kimse yok'}`);
                    }
                }
            }

            // Yeni odaya katıl
            socket.join(room);
            
            if (!onlineUsers.has(room)) {
                onlineUsers.set(room, new Set());
            }
            onlineUsers.get(room).add(socket.user.username);
            
            // Güncel listeyi gönder
            io.to(room).emit("online users", Array.from(onlineUsers.get(room)));
            console.log(`📌 ${socket.user.username} → ${room} odasına katıldı. Online: ${Array.from(onlineUsers.get(room)).join(', ')}`);
            
            // Mesajları yükle
            const messages = await Message.find({ room })
                .sort({ createdAt: -1 })
                .limit(200)
                .sort({ createdAt: 1 });
                
            socket.emit("load messages", messages);
            
        } catch (err) {
            console.error("Oda katılma hatası:", err);
        }
    });
// Kullanıcıyı online yap ve son görülmeyi güncelle
    await User.findByIdAndUpdate(socket.user.id, { 
        isOnline: true,
        lastSeen: new Date()
    });
    
    // Tüm kullanıcılara online durumunu bildir
    io.emit("user status", {
        username: socket.user.username,
        isOnline: true,
        lastSeen: new Date()
    });
   
    /* ===================== MESAJ DÜZENLEME ===================== */
    socket.on("edit message", async (data) => {
        try {
            const { messageId, newMessage } = data;
            
            console.log('✏️ Mesaj düzenleme isteği:', messageId, newMessage);
            
            if (!messageId || !newMessage || !newMessage.trim()) return;
            
            const message = await Message.findById(messageId);
            
            if (!message) {
                console.log('❌ Mesaj bulunamadı');
                return;
            }
            
            if (message.username !== socket.user.username) {
                socket.emit("error message", "❌ Sadece kendi mesajlarınızı düzenleyebilirsiniz!");
                return;
            }
            
            message.message = newMessage.trim();
            message.edited = true;
            await message.save();
            
            console.log('✅ Mesaj düzenlendi:', messageId);
            
            io.to(message.room).emit("message edited", {
                id: messageId,
                newMessage: newMessage.trim(),
                edited: true,
                username: socket.user.username
            });
            
        } catch (err) {
            console.error("Mesaj düzenleme hatası:", err);
        }
    });
// ===================== MESAJ SİLME =====================
socket.on("delete message", async (messageId) => {
    console.log("🗑️ Silme isteği geldi:", messageId);
    
    try {
        // Mesajı bul
        const message = await Message.findById(messageId);
        if (!message) {
            console.log("❌ Mesaj bulunamadı");
            return;
        }
        
        // Sadece mesajın sahibi silebilir
        if (message.username !== socket.user.username) {
            console.log("❌ Yetkisiz silme girişimi:", socket.user.username);
            socket.emit("error message", "❌ Sadece kendi mesajlarınızı silebilirsiniz!");
            return;
        }
        
        // Mesajı sil
        await Message.deleteOne({ _id: messageId });
        
        // Odadaki herkese bildir
        io.to(message.room).emit("message deleted", { id: messageId });
        
        console.log("✅ Mesaj silindi:", messageId);
        
    } catch (err) {
        console.error("❌ Silme hatası:", err);
    }
});
/* ===================== MESAJ GÖNDER ===================== */
socket.on("chat message", async (data) => {
    console.log("🔍 1. GELEN viewOnce:", data.viewOnce);
    
    const { message, room, fileUrl, fileName, fileType, fileSize, viewOnce, replyTo, quoteTo } = data;
    
    console.log("🔍 2. ALINAN viewOnce:", viewOnce);
    
    try {
        if ((!message || !message.trim()) && !fileUrl) return;

        const user = await User.findOne({ username: socket.user.username });
        
        if (!user) {
            console.log("❌ Kullanıcı bulunamadı!");
            return;
        }
        
        if (user.isBanned) {
            socket.emit("error message", "🚫 Banlandınız!");
            return;
        }
        
        if (user.isMuted && user.mutedUntil > new Date()) {
            const remaining = Math.ceil((user.mutedUntil - new Date()) / 60000);
            socket.emit("error message", `🔇 ${remaining} dakika mute edildiniz!`);
            return;
        }
        
        // ========== MESAJI KAYDET (ÖNCE) ==========
        const newMessage = new Message({
            username: socket.user.username,
            message: message ? message.trim() : '',
            room: room,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileType: fileType || null,
            fileSize: fileSize || null,
            avatar: user.avatar || null,
            viewOnce: viewOnce || false,
            replyTo: replyTo || null,
            quoteTo: quoteTo || null
        });
        
        const savedMessage = await newMessage.save();
        console.log("✅ MESAJ KAYDEDİLDİ - ID:", savedMessage._id);
        console.log("🔍 3. KAYDEDİLEN viewOnce:", savedMessage.viewOnce);
        
        // AI ODA KONTROLÜ (SADECE AI YANITI İÇİN, KAYIT YOK)
        if (room === 'ai-bot' && message && message.trim()) {
            console.log('🤖 AI sorusu:', message);
            
            let cevap = "";
            const soru = message.toLowerCase();
            
            if (soru.includes('merhaba') || soru.includes('selam')) {
                cevap = "Merhaba! Hoş geldiniz! 👋 Size nasıl yardımcı olabilirim?";
            }
            else if (soru.includes('nasılsın') || soru.includes('naber')) {
                cevap = "Ben bir yapay zekayım, ama iyiyim! Teşekkür ederim. 😊 Siz nasılsınız?";
            }
            else if (soru.includes('adın') || soru.includes('isim')) {
                cevap = "Benim adım AI Asistan! Sohbet odanızdaki yardımcınızım. 🤖";
            }
            else if (soru.includes('yardım') || soru.includes('help')) {
                cevap = "Size şu konularda yardımcı olabilirim:\n• Sorularınızı cevaplamak\n• Sohbet etmek\n• Dosya paylaşımı\n• Özel mesajlaşma\n\nNe yapmak istersiniz? 💪";
            }
            else if (soru.includes('teşekkür') || soru.includes('sağol')) {
                cevap = "Rica ederim! Her zaman yardıma hazırım. 🙏";
            }
            else if (soru.includes('güle güle') || soru.includes('bay bay')) {
                cevap = "Görüşmek üzere! İyi günler dilerim. 👋";
            }
            else if (soru.includes('hava') || soru.includes('weather')) {
                cevap = "Hava durumu bilgim yok ama şu an dışarıya bakabilirsiniz! ☀️";
            }
            else if (soru.includes('saat') || soru.includes('time')) {
                const now = new Date();
                cevap = `Şu an saat: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} ⏰`;
            }
            else {
                cevap = `"${message}"\n\nBu soruyu sordunuz. Ben basit bir AI asistanım ama öğrenmeye devam ediyorum! 🎓\n\nDaha fazla özellik için "yardım" yazabilirsiniz.`;
            }
            
            setTimeout(() => {
                io.to(room).emit('chat message', {
                    _id: 'ai-' + Date.now(),
                    username: '🤖 AI Asistan',
                    message: cevap,
                    room: 'ai-bot',
                    avatar: null,
                    createdAt: new Date()
                });
            }, 500);
        }
        
        // Mesajı odadaki herkese gönder
        const sockets = await io.in(room).fetchSockets();
        for (const clientSocket of sockets) {
            const targetUser = await User.findOne({ username: clientSocket.user?.username });
            if (targetUser && targetUser.blockedUsers && targetUser.blockedUsers.includes(socket.user.username)) {
                continue;
            }
            clientSocket.emit("chat message", savedMessage);
        }
        
        console.log(`💬 ${socket.user.username} [${room}]: ${message || '[Dosya]'}`);
        
    } catch (err) {
        console.error("❌ MESAJ KAYDETME HATASI:", err);
    }
});

/* ===================== MESAJ TEPKİLERİ ===================== */
socket.on("add reaction", async ({ messageId, reaction }) => {
    try {
        const message = await Message.findById(messageId);
        if (!message) return;
        
        const reactions = message.reactions || new Map();
        let users = reactions.get(reaction) || [];
        
        if (users.includes(socket.user.username)) {
            users = users.filter(u => u !== socket.user.username);
            if (users.length === 0) {
                reactions.delete(reaction);
            } else {
                reactions.set(reaction, users);
            }
        } else {
            users.push(socket.user.username);
            reactions.set(reaction, users);
        }
        
        message.reactions = reactions;
        await message.save();
        
        io.to(message.room).emit("reaction updated", {
            messageId,
            reactions: Object.fromEntries(reactions)
        });
        
    } catch (err) {
        console.error("Tepki ekleme hatası:", err);
    }
});

/* ===================== OKUNDU BİLGİSİ ===================== */
socket.on("mark as read", async (data) => {
    try {
        const { messageIds, room } = data;
        
        await Message.updateMany(
            { 
                _id: { $in: messageIds },
                username: { $ne: socket.user.username },
                readBy: { $ne: socket.user.username }
            },
            { 
                $addToSet: { readBy: socket.user.username },
                $set: { readAt: new Date() }
            }
        );
        
        const updatedMessages = await Message.find({ 
            _id: { $in: messageIds },
            readBy: socket.user.username
        });
        
        io.to(room).emit("messages read", {
            reader: socket.user.username,
            messageIds: updatedMessages.map(m => m._id),
            room: room
        });
        
    } catch (err) {
        console.error("Okundu bildirimi hatası:", err);
    }
});

/* ===================== ÖZEL MESAJLAŞMA (DM) ===================== */
const DirectMessage = require("./models/DirectMessage");

socket.on("join private room", async ({ targetUser }) => {
    try {
        const users = [socket.user.username, targetUser].sort();
        const roomId = `dm_${users[0]}_${users[1]}`;
        
        const rooms = Array.from(socket.rooms);
        rooms.forEach(r => {
            if (r.startsWith('dm_')) {
                socket.leave(r);
            }
        });
        
        socket.join(roomId);
        socket.currentPrivateRoom = roomId;
        
        console.log(`💌 ${socket.user.username} → ${targetUser} ile özel sohbet başlattı`);
        
        const messages = await DirectMessage.find({
            roomId: roomId
        }).sort({ createdAt: 1 }).limit(50);
        
        socket.emit("load private messages", messages);
        
    } catch (err) {
        console.error("Özel odaya katılma hatası:", err);
    }
});

socket.on("private message", async (data) => {
    try {
        const { receiver, message, roomId, fileUrl, fileName, fileType, fileSize } = data;
        
        if ((!message || !message.trim()) && !fileUrl) return;
        
        const newMessage = new DirectMessage({
            sender: socket.user.username,
            receiver: receiver,
            message: message ? message.trim() : '',
            roomId: roomId,
            read: false,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileType: fileType || null,
            fileSize: fileSize || null
        });
        
        await newMessage.save();
        
        io.to(roomId).emit("private message", newMessage);
        
        console.log(`💌 ${socket.user.username} → ${receiver}: ${message || '[Dosya]'}`);
        
    } catch (err) {
        console.error("Özel mesaj gönderme hatası:", err);
    }
});

socket.on("mark as read", async ({ roomId }) => {
    try {
        await DirectMessage.updateMany(
            { 
                roomId: roomId,
                receiver: socket.user.username,
                read: false
            },
            { read: true }
        );
        
        io.to(roomId).emit("messages read", {
            reader: socket.user.username,
            roomId: roomId
        });
        
    } catch (err) {
        console.error("Okundu bildirimi hatası:", err);
    }
});

/* ===================== TEK GÖRÜNÜRLÜK ===================== */
socket.on("view once message", async ({ messageId }) => {
    try {
        console.log("📸 Tek görünürlük mesaj görüntülendi:", messageId);
        
        setTimeout(async () => {
            await Message.findByIdAndDelete(messageId);
            console.log(`✅ Tek görünürlük mesaj silindi: ${messageId}`);
        }, 6000);
        
    } catch (err) {
        console.error("Tek görünürlük hatası:", err);
    }
});

/* ===================== YAZIYOR BİLDİRİMLERİ ===================== */
socket.on("typing", (data) => {
    console.log('✍️ Typing alındı:', data);
    socket.to(data.room).emit("user typing", data.username); // sadece username gönder
});

socket.on("stop typing", (data) => {
    console.log('⏹️ Stop typing alındı:', data);
    socket.to(data.room).emit("user stop typing", data.username); // sadece username gönder
});
/* ===================== MESAJ SİLME ===================== */
socket.on("delete message", async (messageId) => {
    try {
        const message = await Message.findById(messageId);
        
        if (message && message.username === socket.user.username) {
            message.isDeleted = true;
            message.deletedBy = socket.user.username;
            await message.save();
            
            io.to(message.room).emit("message deleted", {
                id: messageId,
                username: socket.user.username
            });
        }
    } catch (err) {
        console.error("Mesaj silme hatası:", err);
    }
});

/* ===================== BAĞLANTI KOPAR ===================== */
socket.on("disconnect", async () => {
    console.log(`🔴 ${socket.user.username} ayrıldı (${socket.id})`);
    
    // Kullanıcıyı offline yap ve son görülmeyi güncelle
    await User.findByIdAndUpdate(socket.user.id, { 
        isOnline: false,
        lastSeen: new Date()
    });
    
    // Tüm kullanıcılara offline durumunu bildir
    io.emit("user status", {
        username: socket.user.username,
        isOnline: false,
        lastSeen: new Date()
    });
    
    onlineUsers.forEach((users, room) => {
        if (users.has(socket.user.username)) {
            users.delete(socket.user.username);
            io.to(room).emit("online users", Array.from(users));
            console.log(`📌 ${room} odası güncel: ${Array.from(users).join(', ') || 'kimse yok'}`);
        }
    });
});

}); // <-- BU, io.on("connection", ... )'un KAPANIŞ PARANTEZİ

// ===================== KULLANICI ENGELLEME İŞLEMLERİ =====================

// Kullanıcıyı engelle / engeli kaldır
app.post('/api/users/:username/block', authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        const userId = req.user.id;
        
        // Kendini engellemeye çalışıyor mu?
        if (username === req.user.username) {
            return res.status(400).json({ message: 'Kendinizi engelleyemezsiniz!' });
        }
        
        // Engellenecek kullanıcı var mı?
        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        }
        
        const user = await User.findById(userId);
        
        // Zaten engellenmiş mi?
        const isBlocked = user.blockedUsers.includes(username);
        
        if (isBlocked) {
            // Engeli kaldır
            user.blockedUsers = user.blockedUsers.filter(u => u !== username);
        } else {
            // Engelle
            user.blockedUsers.push(username);
        }
        
        await user.save();
        
        res.json({ 
            message: isBlocked ? `${username} engeli kaldırıldı` : `${username} engellendi`,
            isBlocked: !isBlocked
        });
        
    } catch (err) {
        console.error('Engelleme hatası:', err);
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});

// Bir kullanıcının engellenip engellenmediğini kontrol et
app.get('/api/users/:username/is-blocked', authMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findById(req.user.id);
        
        const isBlocked = user.blockedUsers.includes(username);
        
        res.json({ isBlocked });
        
    } catch (err) {
        console.error('Kontrol hatası:', err);
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});
// Engellenen kullanıcıları getir
app.get('/api/users/blocked', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Engellenen kullanıcıların detaylarını getir
        const blockedUsers = await User.find({
            username: { $in: user.blockedUsers }
        }).select('username avatar bio lastSeen isOnline');
        
        res.json(blockedUsers);
        
    } catch (err) {
        console.error('Engellenenler getirme hatası:', err);
        res.status(500).json({ message: 'Liste alınamadı' });
    }
});

/* ===================== 404 HANDLER ===================== */
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

/* ===================== SERVER BAŞLAT ===================== */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
