const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');  // ✅ DÜZELTİLDİ
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// ===================== RAPORLAMA =====================

// Kullanıcı raporu (Excel)
router.get('/users/excel', authMiddleware, adminAuth, async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Kullanıcılar');
        
        worksheet.columns = [
            { header: 'Kullanıcı Adı', key: 'username', width: 20 },
            { header: 'Rol', key: 'role', width: 15 },
            { header: 'Durum', key: 'status', width: 15 },
            { header: 'Banlı?', key: 'banned', width: 10 },
            { header: 'Mute?', key: 'muted', width: 10 },
            { header: 'Kayıt Tarihi', key: 'createdAt', width: 20 }
        ];
        
        users.forEach(user => {
            worksheet.addRow({
                username: user.username,
                role: user.role,
                status: user.isBanned ? 'Banlı' : (user.isMuted ? 'Mute' : 'Aktif'),
                banned: user.isBanned ? 'Evet' : 'Hayır',
                muted: user.isMuted ? 'Evet' : 'Hayır',
                createdAt: user.createdAt.toLocaleDateString('tr-TR')
            });
        });
        
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
        };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=kullanicilar.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Excel rapor hatası:', err);
        res.status(500).json({ message: 'Rapor oluşturulamadı' });
    }
});

// Kullanıcı raporu (PDF)
router.get('/users/pdf', authMiddleware, adminAuth, async (req, res) => {
    try {
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=kullanicilar.pdf');
        
        doc.pipe(res);
        
        doc.fontSize(20).text('KULLANICI RAPORU', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'center' });
        doc.moveDown(2);
        
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Kullanıcı Adı', 50, 150);
        doc.text('Rol', 200, 150);
        doc.text('Durum', 280, 150);
        doc.text('Kayıt Tarihi', 380, 150);
        
        doc.moveTo(50, 165).lineTo(550, 165).stroke();
        
        doc.font('Helvetica');
        let y = 180;
        
        users.forEach((user, index) => {
            if (y > 700) {
                doc.addPage();
                y = 50;
                
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('Kullanıcı Adı', 50, y);
                doc.text('Rol', 200, y);
                doc.text('Durum', 280, y);
                doc.text('Kayıt Tarihi', 380, y);
                doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
                y += 30;
                doc.font('Helvetica');
            }
            
            doc.text(user.username, 50, y);
            doc.text(user.role, 200, y);
            doc.text(user.isBanned ? 'Banlı' : (user.isMuted ? 'Mute' : 'Aktif'), 280, y);
            doc.text(user.createdAt.toLocaleDateString('tr-TR'), 380, y);
            
            y += 20;
        });
        
        doc.fontSize(10).text(`Toplam Kullanıcı: ${users.length}`, 50, y + 20);
        
        doc.end();
        
    } catch (err) {
        console.error('PDF rapor hatası:', err);
        res.status(500).json({ message: 'Rapor oluşturulamadı' });
    }
});

// Mesaj raporu (Excel)
router.get('/messages/excel', authMiddleware, adminAuth, async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 }).limit(1000);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mesajlar');
        
        worksheet.columns = [
            { header: 'Kullanıcı', key: 'username', width: 20 },
            { header: 'Mesaj', key: 'message', width: 40 },
            { header: 'Oda', key: 'room', width: 15 },
            { header: 'Tarih', key: 'createdAt', width: 20 }
        ];
        
        messages.forEach(msg => {
            worksheet.addRow({
                username: msg.username,
                message: msg.message || '(dosya)',
                room: msg.room,
                createdAt: msg.createdAt.toLocaleString('tr-TR')
            });
        });
        
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' }
        };
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=mesajlar.xlsx');
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (err) {
        console.error('Excel rapor hatası:', err);
        res.status(500).json({ message: 'Rapor oluşturulamadı' });
    }
});

// Mesaj raporu (PDF)
router.get('/messages/pdf', authMiddleware, adminAuth, async (req, res) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 }).limit(100);
        
        const doc = new PDFDocument({ margin: 50 });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=mesajlar.pdf');
        
        doc.pipe(res);
        
        doc.fontSize(20).text('MESAJ RAPORU', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, { align: 'center' });
        doc.moveDown(2);
        
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Kullanıcı', 50, 150);
        doc.text('Mesaj', 150, 150);
        doc.text('Oda', 350, 150);
        doc.text('Tarih', 430, 150);
        
        doc.moveTo(50, 165).lineTo(550, 165).stroke();
        
        doc.font('Helvetica');
        let y = 180;
        
        messages.forEach((msg, index) => {
            if (y > 700) {
                doc.addPage();
                y = 50;
                
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text('Kullanıcı', 50, y);
                doc.text('Mesaj', 150, y);
                doc.text('Oda', 350, y);
                doc.text('Tarih', 430, y);
                doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
                y += 30;
                doc.font('Helvetica');
            }
            
            const messageText = msg.message || '(dosya)';
            doc.text(msg.username, 50, y);
            doc.text(messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''), 150, y, { width: 180 });
            doc.text(msg.room, 350, y);
            doc.text(msg.createdAt.toLocaleDateString('tr-TR'), 430, y);
            
            y += 20;
        });
        
        doc.fontSize(10).text(`Toplam Mesaj: ${messages.length} (son 100 mesaj)`, 50, y + 20);
        
        doc.end();
        
    } catch (err) {
        console.error('PDF rapor hatası:', err);
        res.status(500).json({ message: 'Rapor oluşturulamadı' });
    }
});

module.exports = router;