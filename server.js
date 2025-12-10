// server.js - АДАПТИРОВАННАЯ ВЕРСИЯ ДЛЯ RENDER

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); 
const multer = require('multer');       
const jwt = require('jsonwebtoken');    
const mongoose = require('mongoose'); 
const fs = require('fs'); 
const path = require('path'); // МОДУЛЬ ДЛЯ РАБОТЫ С ПУТЯМИ

const app = express();
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 1: ИСПОЛЬЗУЕМ ПОРТ, КОТОРЫЙ ПРЕДОСТАВЛЯЕТ RENDER
const port = process.env.PORT || 3000; 

// --- 1. НАСТРОЙКА БАЗЫ ДАННЫХ ---
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЯ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const DB_URI = process.env.DB_URI;

if (!DB_URI) {
    console.error("ОШИБКА: DB_URI не задан. Проверьте переменные окружения Render.");
    process.exit(1);
}

mongoose.connect(DB_URI)
    .then(() => console.log('Успешное подключение к MongoDB Atlas.'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB Atlas. Проверьте ключ DB_URI и доступ.', err);
        process.exit(1);
    });

// --- ОПРЕДЕЛЕНИЕ СХЕМ И МОДЕЛЕЙ (Без изменений) ---
const UserSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    verificationCode: String,
    codeExpires: Date
});
const UserModel = mongoose.model('User', UserSchema, 'users'); 

const VideoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    uploaderLogin: { type: String, required: true },
    filePath: { type: String, required: true }, // Путь к файлу на сервере
    uploadDate: { type: Date, default: Date.now },
    isShorts: { type: Boolean, default: false }
});
const VideoModel = mongoose.model('Video', VideoSchema, 'videos'); 

// --- 2. НАСТРОЙКА NODEMAILER ---
const SENDER_EMAIL = 'arttube2025@gmail.com'; 
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЕ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const SENDER_PASS = process.env.SENDER_PASS; 

if (!SENDER_PASS) {
    console.error("ОШИБКА: SENDER_PASS не задан. Проверьте переменные окружения Render.");
}

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASS 
    }
});

// --- 3. НАСТРОЙКА JWT ---
// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЕ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("ОШИБКА: JWT_SECRET не задан. Проверьте переменные окружения Render.");
}

// --- 4. MIDDLEWARE И НАСТРОЙКИ ---
app.use(bodyParser.json());

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 3: ОТДАЧА ВСЕХ СТАТИЧЕСКИХ ФАЙЛОВ
// Это позволяет браузеру загрузить youtube.js, youtube.html, CSS и т.д.
app.use(express.static(__dirname)); 


// Защита: Middleware для проверки токена (Без изменений)
function authenticateToken(req, res, next) {
    // ... (ваш код аутентификации)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- 5. НАСТРОЙКА MULTER (ВРЕМЕННОЕ ХРАНЕНИЕ) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads'); // Используем path.join для совместимости
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });


// ===============================================
// ОСНОВНАЯ ЛОГИКА (МАРШРУТЫ)
// ===============================================

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 4: МАРШРУТ ДЛЯ КОРНЯ
// Отправляет файл 'youtube.html' при запросе к адресу вашего сайта (/).
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'youtube.html'));
});


// ... (Остальные маршруты: /api/upload, /api/videos, /api/stream/:id, /api/video/:id, /api/account)
// Оставьте их без изменений, они используют относительные пути и логика верна.
// Убедитесь, что все маршруты из вашего оригинального кода здесь присутствуют.


// 10. Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен и слушает порт ${port}`);
});
