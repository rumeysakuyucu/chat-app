const mongoose = require("mongoose");

const DirectMessageSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    receiver: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    roomId: {
        type: String,
        required: true  // İki kullanıcıya özel oda ID'si
    },
    read: {
        type: Boolean,
        default: false
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    fileType: {
        type: String,
        default: null
    },
    fileSize: {
        type: Number,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model("DirectMessage", DirectMessageSchema);