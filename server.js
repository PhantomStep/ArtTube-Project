// server.js - ФИНАЛЬНАЯ ВЕРСИЯ ДЛЯ RENDER

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); 
const multer = require('multer');       
const jwt = require('jsonwebtoken');    
const mongoose = require('mongoose'); 
const fs = require('fs'); 
const path = require('path'); 

const app = express();
// ИСПОЛЬЗУЕМ ПОРТ, КОТОРЫЙ ПРЕДОСТАВЛЯЕТ RENDER
const port = process.env.PORT || 3000; 

// --- 1. НАСТРОЙКА БАЗЫ ДАННЫХ (ЧИТАЕМ ИЗ RENDER) ---
const DB_URI = process.env.DB_URI;

mongoose.connect(DB_URI)
    .then(() => console.log('Успешное подключение к MongoDB Atlas. СЕРВЕР СТАРТУЕТ...'))
    .catch(err => {
        // ЭТО СООБЩЕНИЕ ПОЯВИТСЯ В ЛОГАХ RENDER, ЕСЛИ КЛЮЧ DB_URI НЕВЕРЕН
        console.error('КРИТИЧЕСКАЯ ОШИБКА: Ошибка подключения к MongoDB Atlas. ПРОВЕРЬТЕ КЛЮЧ DB_URI И ДОСТУП В RENDER!', err);
        process.exit(1); // Останавливаем сервер, чтобы Render показал ошибку
    });

// --- ОПРЕДЕЛЕНИЕ СХЕМ И МОДЕЛЕЙ (Без изменений) ---
// ВСТАВЬТЕ СЮДА ВАШИ СХЕМЫ И МОДЕЛИ (UserSchema, VideoSchema и т.д.)

// --- 2. НАСТРОЙКА NODEMAILER (ЧИТАЕМ ИЗ RENDER) ---
const SENDER_EMAIL = 'arttube2025@gmail.com'; 
const SENDER_PASS = process.env.SENDER_PASS; // Читаем из Render

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASS 
    }
});

// --- 3. НАСТРОЙКА JWT (ЧИТАЕМ ИЗ RENDER) ---
const JWT_SECRET = process.env.JWT_SECRET; // Читаем из Render

// --- 4. MIDDLEWARE И НАСТРОЙКИ ---
app.use(bodyParser.json());
// ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ (youtube.js, CSS и т.д.)
app.use(express.static(__dirname)); 


// Защита: Middleware для проверки токена (Без изменений)
function authenticateToken(req, res, next) {
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
        const dir = path.join(__dirname, 'uploads');
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
// МАРШРУТЫ
// ===============================================

// МАРШРУТ ДЛЯ КОРНЯ: ОТДАЧА HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'youtube.html'));
});

// ... (ВСЕ ОСТАЛЬНЫЕ ВАШИ МАРШРУТЫ: /api/upload, /api/videos, /api/login и т.д.)


// 10. Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен и слушает порт ${port}`);
});
