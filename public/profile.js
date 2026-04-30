// profile.js
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

// Elementler
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const saveAvatarBtn = document.getElementById('saveAvatarBtn');
const bioText = document.getElementById('bioText');
const saveBioBtn = document.getElementById('saveBioBtn');
const charCount = document.getElementById('charCount');
let selectedFile = null;

// Karakter sayacı
bioText.addEventListener('input', () => {
    const count = bioText.value.length;
    charCount.textContent = count;
});

// Bio kaydet
saveBioBtn.addEventListener('click', async () => {
    const bio = bioText.value.trim();
    
    try {
        const res = await fetch('/api/users/bio', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bio })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert('✅ Hakkımda yazısı güncellendi!');
        } else {
            alert('❌ Hata: ' + data.message);
        }
    } catch (err) {
        alert('Hata oluştu!');
    }
});
// URL'den kullanıcı adını al
const urlParams = new URLSearchParams(window.location.search);
const profileUsername = urlParams.get('user');

// Profil bilgilerini yükle (başkasının profilini göster)
async function loadProfile() {
    try {
        // Eğer URL'de kullanıcı varsa onun profilini getir, yoksa kendi profilini
        const url = profileUsername 
            ? `/api/users/${profileUsername}` 
            : '/api/users/profile';
        
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await res.json();
        
        // Sayfa başlığını güncelle
        document.querySelector('.profile-header h2').textContent = 
            profileUsername ? `👤 ${user.username} Profili` : '👤 Profilim';
        
        // Avatar
        if (user.avatar) {
            avatarPreview.src = user.avatar.startsWith('http') ? user.avatar : `http://localhost:3000${user.avatar}`;
        }
        
        // Bio
        if (user.bio) {
            bioText.value = user.bio;
            charCount.textContent = user.bio.length;
        } else {
            bioText.value = '';
            charCount.textContent = '0';
        }
        
        // Eğer başkasının profiliyse, bio alanını sadece okunur yap
        if (profileUsername && profileUsername !== user.username) {
            bioText.disabled = true;
            saveBioBtn.style.display = 'none';
        } else {
            bioText.disabled = false;
            saveBioBtn.style.display = 'inline-block';
        }
           const avatarUpload = document.querySelector('.avatar-upload');
        if (profileUsername && profileUsername !== user.username) {
            // Başkasının profilindeyse bio'yu pasif yap
            bioText.disabled = true;
            saveBioBtn.style.display = 'none';
            
            // Avatar yükleme butonlarını gizle
            if (avatarUpload) {
                avatarUpload.style.display = 'none';
            }
        } else {
            // Kendi profilindeyse bio'yu aktif yap
            bioText.disabled = false;
            saveBioBtn.style.display = 'inline-block';
            
            // Avatar yükleme butonlarını göster
            if (avatarUpload) {
                avatarUpload.style.display = 'flex';
            }
        }
        // Son görülme ve online durumu
        const lastSeen = user.lastSeen ? new Date(user.lastSeen).toLocaleString('tr-TR') : 'Bilinmiyor';
        const onlineStatus = user.isOnline ? 
            '<span class="online-badge online">🟢 Çevrimiçi</span>' : 
            '<span class="online-badge offline">⚪ Çevrimdışı</span>';
        
        const registerDate = user.createdAt 
            ? new Date(user.createdAt).toLocaleDateString('tr-TR') 
            : 'Bilinmiyor';
        
        document.getElementById('profileInfo').innerHTML = `
            <div class="info-row">
                <span class="info-label">Kullanıcı Adı</span>
                <span class="info-value">${user.username}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Durum</span>
                <span class="info-value">${onlineStatus}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Son Görülme</span>
                <span class="info-value">${lastSeen}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Rol</span>
                <span class="info-value">${user.role}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Kayıt Tarihi</span>
                <span class="info-value">${registerDate}</span>
            </div>
        `;
    } catch (err) {
        console.error('Profil yüklenemedi:', err);
    }
}
// Resim seç
avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 1 * 1024 * 1024) {
        alert('Profil resmi 1MB\'dan büyük olamaz!');
        avatarInput.value = '';
        return;
    }
    
    selectedFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        avatarPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    saveAvatarBtn.style.display = 'inline-block';
});

// Resmi kaydet
saveAvatarBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('avatar', selectedFile);
    
    try {
        const res = await fetch('/api/users/avatar', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            alert('✅ Profil resmi güncellendi!');
            saveAvatarBtn.style.display = 'none';
            avatarInput.value = '';
        } else {
            alert('❌ Hata: ' + data.message);
        }
    } catch (err) {
        alert('Hata oluştu!');
    }
});

// Socket bağlantısı (online/offline takibi için)
const socket = io('http://localhost:3000', {
    auth: { token }
});

socket.on('user status', (data) => {
    console.log('📢 Kullanıcı durumu değişti:', data);
    const username = document.querySelector('.info-value:first-child')?.textContent;
    if (username === data.username) {
        loadProfile();
    }
});

// Sayfa yüklendiğinde
loadProfile();