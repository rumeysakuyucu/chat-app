const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    username: { type: String, required: true },
    message: { type: String, default: '' },
    room: { type: String, required: true },
    avatar: { type: String, default: null },
    edited: { type: Boolean, default: false },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    viewOnce: { type: Boolean, default: false },
    viewed: { type: Boolean, default: false },
    
    // MESAJ TEPKİLERİ
    reactions: {
        type: Map,
        of: [String],  // { "👍": ["rumeysa", "ayla"], "❤️": ["rumeysa"] }
        default: {}
    },
    
    // ✅ OKUNDU BİLGİSİ - reactions'ın DIŞINDA
    readBy: {
        type: [String],  // Okuyan kullanıcı adları
        default: []
    },
    readAt: {
        type: Date,
        default: null
    },
   // 🟢 YENİ - YANITLANAN MESAJ BİLGİSİ
    replyTo: {
        type: {
            messageId: { type: String, required: true },
            username: { type: String, required: true },
            message: { type: String, default: '' },
            fileUrl: { type: String, default: null },
            fileName: { type: String, default: null }
        },
        required: false,
        default: null
    },
 // 🟢 YENİ - Sabitlenmiş mesaj bilgisi
     isPinned: {
        type: Boolean,
        default: false
    },
    pinnedBy: {
        type: String,
        default: null
    },
    pinnedAt: {
        type: Date,
        default: null
    },
 // 🟢 YENİ - Alıntı bilgisi
    quoteTo: {
        type: {
            messageId: { type: String, required: true },
            username: { type: String, required: true },
            message: { type: String, default: '' },
            fileUrl: { type: String, default: null },
            fileName: { type: String, default: null }
        },
        required: false,
        default: null
    }
}, { timestamps: true });
module.exports = mongoose.model("Message", MessageSchema);