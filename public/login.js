// Login sayfası hazır olduğunda
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Login sayfası yüklendi");
    
    const loginForm = document.getElementById("loginForm");
    const errorMessage = document.getElementById("errorMessage");
    
    // Token varsa direkt chat'e yönlendir
    const token = localStorage.getItem("token");
    if (token) {
        window.location.href = "/chat";
        return;
    }
    
    // Form submit olayı
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Input değerlerini al
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        
        // Boş alan kontrolü
        if (!username || !password) {
            errorMessage.textContent = "Kullanıcı adı ve şifre boş olamaz!";
            return;
        }
        
        // Hata mesajını temizle
        errorMessage.textContent = "";
        
        try {
            console.log("📤 Login isteği gönderiliyor...");
            
            // Login isteği
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            console.log("📥 Sunucu cevabı:", data);
            
            if (!response.ok) {
                throw new Error(data.message || "Giriş başarısız!");
            }
            
            // Token'ı ve bilgileri kaydet
            localStorage.setItem("token", data.token);
            localStorage.setItem("username", data.username);
            localStorage.setItem("role", data.role);  // 🟢 ROLÜ KAYDET
            
            console.log("✅ Token kaydedildi, rol:", data.role);
            
            // Chat sayfasına yönlendir
            window.location.href = "/chat";
            
        } catch (error) {
            console.error("❌ Login hatası:", error);
            errorMessage.textContent = error.message;
        }
    });
});