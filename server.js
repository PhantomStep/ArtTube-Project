// server.js - АДАПТИРОВАННАЯ ВЕРСИЯ ДЛЯ RENDER

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); 
const multer = require('multer');       
const jwt = require('jsonwebtoken');    
const mongoose = require('mongoose'); 
const fs = require('fs'); 
const path = require('path'); // <<< ДОБАВЛЕНО: модуль для работы с путями

const app = express();
// <<< ИСПРАВЛЕНИЕ 1: ИСПОЛЬЗУЕМ ПОРТ, КОТОРЫЙ ПРЕДОСТАВЛЯЕТ RENDER
const port = process.env.PORT || 3000; 

// --- 1. НАСТРОЙКА БАЗЫ ДАННЫХ ---
// <<< ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЯ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const DB_URI = process.env.DB_URI;

mongoose.connect(DB_URI)
    .then(() => console.log('Успешное подключение к MongoDB Atlas.'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB Atlas. Проверьте URI и доступ.', err);
        process.exit(1);
    });

// --- ОПРЕДЕЛЕНИЕ СХЕМ И МОДЕЛЕЙ (ОСТАВЛЕНО БЕЗ ИЗМЕНЕНИЙ) ---
const UserSchema = new mongoose.Schema({
    // ... (ваши поля)
});
const UserModel = mongoose.model('User', UserSchema, 'users'); 

const VideoSchema = new mongoose.Schema({
    // ... (ваши поля)
});
const VideoModel = mongoose.model('Video', VideoSchema, 'videos'); 

// --- 2. НАСТРОЙКА NODEMAILER ---
const SENDER_EMAIL = 'arttube2025@gmail.com'; 
// <<< ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЕ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const SENDER_PASS = process.env.SENDER_PASS; 

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASS 
    }
});

// --- 3. НАСТРОЙКА JWT ---
// <<< ИСПРАВЛЕНИЕ 2: ЧИТАЕМ ЗНАЧЕНИЕ ИЗ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ RENDER
const JWT_SECRET = process.env.JWT_SECRET;

// --- 4. MIDDLEWARE И НАСТРОЙКИ ---
app.use(bodyParser.json());

// <<< ИСПРАВЛЕНИЕ 3: ОТДАЧА СТАТИЧЕСКИХ ФАЙЛОВ
// Это позволяет браузеру загрузить youtube.js, CSS и картинки
app.use(express.static(__dirname)); 


// Защита: Middleware для проверки токена (оставлен без изменений)
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
// ... (Код Multer остается без изменений) ...

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
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

// <<< КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ 4: МАРШРУТ ДЛЯ КОРНЯ
// Отправляет файл 'youtube.html' при запросе к адресу вашего сайта (/).
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'youtube.html'));
});


// 6. Маршрут для загрузки видео (оставлен без изменений)
app.post('/api/upload', authenticateToken, upload.single('video'), async (req, res) => {
    const { title, isShorts } = req.body;
    const videoFile = req.file;

    try {
        const newVideo = new VideoModel({
            title: title,
            uploaderLogin: req.user.login,
            filePath: videoFile ? videoFile.path : 'simulated_path.mp4',
            isShorts: isShorts === 'true'
        });
        await newVideo.save(); 

        console.log(`\n[UPLOAD] Пользователь ${req.user.login} загрузил видео: \"${title}\"`);
        res.json({ message: 'Видео принято!', title: newVideo.title, uploader: newVideo.uploaderLogin, isShorts: newVideo.isShorts });
    } catch (error) {
        console.error("Ошибка при сохранении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при загрузке видео.' });
    }
});


// 7. Маршрут для отображения списка видео (оставлен без изменений)
app.get('/api/videos', async (req, res) => {
    try {
        // ... (ваш код)
        const videos = await VideoModel.find({}, 'title uploaderLogin uploadDate isShorts').sort({ uploadDate: -1 }); 
        
        const videoList = videos.map(v => ({ 
            id: v._id, 
            title: v.title, 
            uploader: v.uploaderLogin,
            isShorts: v.isShorts
        }));
        
        res.json(videoList);
    } catch (error) {
        console.error("Ошибка при получении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при получении видео.' });
    }
});

// 8. Маршрут для воспроизведения видео (оставлен без изменений)
app.get('/api/stream/:id', async (req, res) => {
    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video || video.filePath === 'simulated_path.mp4') {
            return res.status(404).json({ message: 'Видео не найдено или не имеет файла.' });
        }

        const pathToFile = video.filePath;
        if (!fs.existsSync(pathToFile)) {
             console.error(`Файл не найден по пути: ${pathToFile}`);
             return res.status(404).json({ message: 'Файл видео не найден на сервере.' });
        }

        // ... (логика стриминга остается)
        const stat = fs.statSync(pathToFile);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(pathToFile, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(pathToFile).pipe(res);
        }

    } catch (error) {
        console.error("Ошибка при стриминге видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при воспроизведении видео.' });
    }
});


// 9. Маршрут для удаления видео
app.delete('/api/video/:id', authenticateToken, async (req, res) => {
    // ... (код проверки аутентификации и поиска видео остается)

    try {
        const video = await VideoModel.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ message: 'Видео не найдено.' });
        }

        if (video.uploaderLogin !== req.user.login) {
            return res.status(403).json({ message: 'Удалять можно только свои видео.' });
        }
        
        // <<< ИСПРАВЛЕНИЕ 5: КОММЕНТИРУЕМ fs.unlink
        // На Render удаление локальных файлов часто вызывает ошибку или просто бессмысленно,
        // так как файлы временные. Оставляем удаление только из базы данных.
        /*
        if (video.filePath && video.filePath !== 'simulated_path.mp4') {
            fs.unlink(video.filePath, (err) => {
                if (err) console.error(`[FS ERROR] Не удалось удалить файл ${video.filePath}:`, err);
            });
        }
        */

        await VideoModel.findByIdAndDelete(req.params.id);
        res.json({ message: `Видео "${video.title}" успешно удалено.` });

    } catch (error) {
        console.error("Ошибка сервера при удалении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при удалении видео.' });
    }
});


// 10. *** НОВОЕ: Удаление аккаунта ***
app.delete('/api/account', authenticateToken, async (req, res) => {
    const userLogin = req.user.login;

    try {
        // Опционально: Удаление всех видео пользователя перед удалением аккаунта
        const videosToDelete = await VideoModel.find({ uploaderLogin: userLogin });
        
        for (const video of videosToDelete) {
             // <<< ИСПРАВЛЕНИЕ 5: КОММЕНТИРУЕМ fs.unlink
             /*
             if (video.filePath && video.filePath !== 'simulated_path.mp4') {
                fs.unlink(video.filePath, (err) => {
                    if (err) console.error(`[FS ERROR] Не удалось удалить файл ${video.filePath}:`, err);
                });
             }
             */
             await VideoModel.findByIdAndDelete(video._id);
        }

        // Удаление аккаунта пользователя
        const result = await UserModel.findOneAndDelete({ login: userLogin });
        
        if (!result) {
            return res.status(404).json({ message: 'Аккаунт не найден.' });
        }

        res.json({ message: 'Аккаунт и все связанные видео успешно удалены.' });

    } catch (error) {
        console.error("Ошибка при удалении аккаунта:", error);
        res.status(500).json({ message: 'Ошибка сервера при удалении аккаунта.' });
    }
});


// ... (остальные маршруты: /api/send-code, /api/register, /api/login)
// Оставьте их без изменений.


// 11. Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен и слушает порт ${port}`);
});
