const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const Log = require('../models/Log');
const authMiddleware = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

// Tüm admin route'ları için yetki kontrolü
router.use(authMiddleware);
router.use(adminAuth);

// Dashboard istatistikleri
router.get('/dashboard', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalMessages = await Message.countDocuments();
        const bannedUsers = await User.countDocuments({ isBanned: true });
        
        // Son 7 günlük mesaj istatistiği
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const count = await Message.countDocuments({
                createdAt: { $gte: date, $lt: nextDate }
            });
            
            last7Days.push({
                date: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
                count
            });
        }
        
        // Oda bazlı mesaj sayıları
        const rooms = await Message.aggregate([
            { $group: { _id: "$room", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        res.json({
            totalUsers,
            totalMessages,
            bannedUsers,
            last7Days,
            rooms
        });
        
    } catch (err) {
        console.error('Dashboard hatası:', err);
        res.status(500).json({ message: 'Dashboard yüklenemedi' });
    }
});

// Tüm kullanıcıları getir
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Kullanıcılar yüklenemedi' });
    }
});

// Kullanıcı banla
router.post('/users/:userId/ban', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        user.isBanned = true;
        await user.save();
        
        // Log kaydet
        await Log.create({
            action: 'BAN',
            performedBy: req.user.username,
            targetUser: user.username,
            details: { reason: req.body.reason || 'Belirtilmemiş' }
        });
        
        res.json({ message: 'Kullanıcı banlandı' });
    } catch (err) {
        res.status(500).json({ message: 'Ban işlemi başarısız' });
    }
});

// Kullanıcının banını kaldır
router.post('/users/:userId/unban', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        user.isBanned = false;
        await user.save();
        
        await Log.create({
            action: 'UNBAN',
            performedBy: req.user.username,
            targetUser: user.username
        });
        
        res.json({ message: 'Ban kaldırıldı' });
    } catch (err) {
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});

// Kullanıcıyı mute et
router.post('/users/:userId/mute', async (req, res) => {
    try {
        const { duration } = req.body; // dakika cinsinden
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        const mutedUntil = new Date();
        mutedUntil.setMinutes(mutedUntil.getMinutes() + duration);
        
        user.isMuted = true;
        user.mutedUntil = mutedUntil;
        await user.save();
        
        await Log.create({
            action: 'MUTE',
            performedBy: req.user.username,
            targetUser: user.username,
            details: { duration }
        });
        
        res.json({ message: 'Kullanıcı mute edildi' });
    } catch (err) {
        res.status(500).json({ message: 'Mute işlemi başarısız' });
    }
});

// Mute kaldır
router.post('/users/:userId/unmute', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        user.isMuted = false;
        user.mutedUntil = null;
        await user.save();
        
        await Log.create({
            action: 'UNMUTE',
            performedBy: req.user.username,
            targetUser: user.username
        });
        
        res.json({ message: 'Mute kaldırıldı' });
    } catch (err) {
        res.status(500).json({ message: 'İşlem başarısız' });
    }
});

// Rol değiştir
router.post('/users/:userId/role', async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
        
        const oldRole = user.role;
        user.role = role;
        await user.save();
        
        await Log.create({
            action: 'ROLE_CHANGE',
            performedBy: req.user.username,
            targetUser: user.username,
            details: { oldRole, newRole: role }
        });
        
        res.json({ message: 'Rol değiştirildi' });
    } catch (err) {
        res.status(500).json({ message: 'Rol değiştirilemedi' });
    }
});

// Mesajları getir
router.get('/messages', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        const messages = await Message.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Message.countDocuments();
        
        res.json({
            messages,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ message: 'Mesajlar yüklenemedi' });
    }
});

// Tek mesaj sil
router.delete('/messages/:messageId', async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: 'Mesaj bulunamadı' });
        
        await Message.findByIdAndDelete(req.params.messageId);
        
        await Log.create({
            action: 'MESSAGE_DELETE',
            performedBy: req.user.username,
            details: { 
                messageContent: message.message,
                username: message.username 
            }
        });
        
        res.json({ message: 'Mesaj silindi' });
    } catch (err) {
        res.status(500).json({ message: 'Mesaj silinemedi' });
    }
});

// Toplu mesaj sil - oda bazlı
router.delete('/messages/room/:roomName', async (req, res) => {
    try {
        const result = await Message.deleteMany({ room: req.params.roomName });
        
        await Log.create({
            action: 'BULK_DELETE',
            performedBy: req.user.username,
            targetRoom: req.params.roomName,
            details: { deletedCount: result.deletedCount }
        });
        
        res.json({ message: `${result.deletedCount} mesaj silindi` });
    } catch (err) {
        res.status(500).json({ message: 'Silme işlemi başarısız' });
    }
});

// Tüm odaları getir
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Message.aggregate([
            { $group: { 
                _id: "$room", 
                messageCount: { $sum: 1 },
                lastMessage: { $max: "$createdAt" }
            }},
            { $sort: { lastMessage: -1 } }
        ]);
        
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: 'Odalar yüklenemedi' });
    }
});

// Logları getir
router.get('/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        const query = {};
        if (req.query.action) query.action = req.query.action;
        if (req.query.user) query.targetUser = req.query.user;
        
        const logs = await Log.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
            
        const total = await Log.countDocuments(query);
        
        res.json({
            logs,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        console.error('Log hatası:', err);
        res.status(500).json({ message: 'Loglar yüklenemedi' });
    }
});

module.exports = router;