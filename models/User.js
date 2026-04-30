const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["user", "admin", "moderator"],
        default: "user"
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    isMuted: {
        type: Boolean,
        default: false
    },
    mutedUntil: {
        type: Date,
        default: null
    },
    avatar: {
        type: String,
        default: null
    },
    // 🟢 YENİ ALANLAR
    bio: {
        type: String,
        default: "",
        maxlength: 150
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    isOnline: {
        type: Boolean,
        default: false
    },
  // 🟢 YENİ - Yıldızlanan mesajlar
    starredMessages: {
        type: [String],  // Mesaj ID'leri
        default: []
    },
  // 🟢 YENİ - Engellenen kullanıcılar
    blockedUsers: {
        type: [String],  // Engellenen kullanıcı adları
        default: []
    }
}, { timestamps: true });
// Şifre hash'leme middleware'i
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Şifre karşılaştırma metodu
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);