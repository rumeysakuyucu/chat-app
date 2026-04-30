const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: ['BAN', 'UNBAN', 'MUTE', 'UNMUTE', 'ROLE_CHANGE', 'MESSAGE_DELETE', 'ROOM_CREATE', 'ROOM_DELETE', 'BULK_DELETE']
    },
    performedBy: {
        type: String,
        required: true
    },
    targetUser: {
        type: String,
        default: null
    },
    targetRoom: {
        type: String,
        default: null
    },
    details: {
        type: Object,
        default: {}
    },
    ip: {
        type: String,
        default: 'Bilinmiyor'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Log", LogSchema);