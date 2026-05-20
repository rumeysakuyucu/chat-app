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

            // ANDROID EMULATOR İÇİN 10.0.2.2 KULLANILIR
           const response = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            // Gelen cevabı text olarak al
            const text = await response.text();
            console.log("📥 Ham sunucu cevabı:", text);

            // JSON parse etmeye çalış
            let data;

            try {
                data = JSON.parse(text);
            } catch (jsonError) {
                throw new Error("Sunucudan geçersiz cevap geldi!");
            }

            console.log("📥 Sunucu cevabı:", data);

            if (!response.ok) {
                throw new Error(data.message || "Giriş başarısız!");
            }

            // Token ve kullanıcı bilgilerini kaydet
            localStorage.setItem("token", data.token);
            localStorage.setItem("username", data.username);
            localStorage.setItem("role", data.role);

            console.log("✅ Token kaydedildi, rol:", data.role);

            // Chat sayfasına yönlendir
            window.location.href = "/chat";

        } catch (error) {
            console.error("❌ Login hatası:", error);
            errorMessage.textContent = error.message;
        }
    });
});