# FilmKeyfi

FilmKeyfi için Express tabanlı başlangıç full-stack proje.

## Özellikler

- Kullanıcı kayıt/giriş/çıkış
- Admin yetkilendirme
- Admin dashboard
- Kullanıcı yönetimi
- Kategori yönetimi
- MP4 film yükleme ve HTML5 video oynatma
- Destek mesajları
- Ödeme kayıtları
- Shopier ayar ekranı ve webhook endpoint'i
- Site ayarları

## Kurulum

1. Node.js 18+ kurulu bir sunucuya dosyaları yükleyin.
2. `npm install`
3. `.env.example` dosyasını `.env` olarak kopyalayın.
4. `JWT_SECRET`, `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerlerini değiştirin.
5. `npm start`
6. Site: `http://sunucu-adresi:3000`
7. Admin: `http://sunucu-adresi:3000/admin.html`

## Önemli

Shopier canlı ödeme akışının imza doğrulama, callback alanları ve ödeme oluşturma bölümleri Shopier hesabınızda kullanılan güncel entegrasyon yöntemine göre tamamlanmalıdır. API anahtarlarını frontend'e koymayın.

`uploads/` klasörü MP4 dosyalarını, `data/db.json` uygulama verilerini tutar. Gerçek üretim ortamında PostgreSQL/MySQL ve nesne depolama kullanılması önerilir.
