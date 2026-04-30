// Admin yetkisi kontrolü
const adminAuth = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Bu işlem için admin yetkisi gerekli!" });
    }
};

// Moderator veya admin yetkisi kontrolü
const isModerator = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
        next();
    } else {
        res.status(403).json({ message: "Bu işlem için yetkiniz yok!" });
    }
};

module.exports = { adminAuth, isModerator };