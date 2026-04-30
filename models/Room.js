const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    createdBy: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // 🟢 Sabitlenmiş mesajlar
    pinnedMessages: {
        type: [String],  // Mesaj ID'leri
        default: []
    },
    isPrivate: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model("Room", RoomSchema);