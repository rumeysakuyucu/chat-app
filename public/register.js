document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ Register sayfası yüklendi");
    
    const registerForm = document.getElementById("registerForm");
    const messageDiv = document.getElementById("message");
    
    // Token varsa direkt chat'e yönlendir
    const token = localStorage.getItem("token");
    if (token) {
        window.location.href = "/chat";
        return;
    }
    
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const confirmPassword = document.getElementById("confirmPassword").value.trim();
        
        // Validasyonlar
        if (!username || !password || !confirmPassword) {
            showMessage("Tüm alanları doldurun!", "error");
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage("Şifreler eşleşmiyor!", "error");
            return;
        }
        
        if (password.length < 6) {
            showMessage("Şifre en az 6 karakter olmalı!", "error");
            return;
        }
        
        try {
            console.log("📤 Kayıt isteği gönderiliyor...");
            
            const response = await fetch("/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            console.log("📥 Sunucu cevabı:", data);
            
            if (!response.ok) {
                throw new Error(data.message || "Kayıt başarısız!");
            }
            
            // Başarılı mesajı göster
            showMessage("✅ Kayıt başarılı! Yönlendiriliyorsunuz...", "success");
            
            // 2 saniye sonra login sayfasına yönlendir
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 2000);
            
        } catch (error) {
            console.error("❌ Kayıt hatası:", error);
            showMessage(error.message, "error");
        }
    });
    
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = type === "error" ? "error-message" : "success-message";
    }
});