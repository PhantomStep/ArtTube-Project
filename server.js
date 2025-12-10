// server.js - ВЕРСИЯ С РАБОЧЕЙ ПАГИНАЦИЕЙ
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer'); 
const multer = require('multer');       
const jwt = require('jsonwebtoken');    
const mongoose = require('mongoose'); 
const fs = require('fs'); 

const app = express();
const port = 3000;

// --- 1. НАСТРОЙКА БАЗЫ ДАННЫХ ---
const DB_URI = 'mongodb+srv://artemkf161rus_db_user:EyMce3RYRmnbQDlA@cluster0.oh9jmay.mongodb.net/youtube_clone_db?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(DB_URI)
    .then(() => console.log('Успешное подключение к MongoDB Atlas.'))
    .catch(err => {
        console.error('Ошибка подключения к MongoDB Atlas. Проверьте URI и доступ.', err);
        process.exit(1);
    });

// --- 2. НАСТРОЙКА NODEMAILER ---
const SENDER_EMAIL = 'arttube2025@gmail.com'; 
const SENDER_PASS = 'ppqceaepkkzbuwkq'; 

const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: SENDER_EMAIL,
        pass: SENDER_PASS
    }
});

// --- 3. ОПРЕДЕЛЕНИЕ СХЕМ ---
const UserSchema = new mongoose.Schema({
    login: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true }, 
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const UserModel = mongoose.model('User', UserSchema);

const VideoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    uploaderLogin: { type: String, required: true },
    filePath: { type: String, required: true },
    isShorts: { type: Boolean, default: false },
    uploadDate: { type: Date, default: Date.now }
});
const VideoModel = mongoose.model('Video', VideoSchema);


// --- 4. Middleware и Настройки ---
const verificationCodes = new Map();
const upload = multer({ dest: 'uploads/' });
const JWT_SECRET = 'your_super_secret_key_123'; 
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); 

// КРИТИЧЕСКИ ВАЖНОЕ: Делаем папку uploads доступной по URL /uploads
app.use('/uploads', express.static('uploads')); 


// --- Вспомогательные функции ---

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(email, code) {
    const mailOptions = {
        from: `"Arttube Support" <${SENDER_EMAIL}>`,
        to: email,
        subject: 'Ваш код верификации (Arttube)',
        text: `Ваш 6-значный код верификации: ${code}.`
    };
    
    try {
        let info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error(`[ERROR] Ошибка при отправке почты на ${email}.`, error);
        return false;
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ message: 'Требуется токен.' }); 

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Недействительный токен.' });
        req.user = user;
        next();
    });
}


// --- 5. API Маршруты ---

// 1. Отправка кода верификации (Регистрация)
app.post('/api/send-code', async (req, res) => {
    // ... (без изменений)
    const { login, email, password } = req.body;
    
    const existingUser = await UserModel.findOne({ $or: [{ email }, { login }] });
    if (existingUser) {
        return res.status(400).json({ message: 'Пользователь с таким логином или почтой уже существует.' });
    }

    const code = generateCode();
    verificationCodes.set(email, { code, login, password }); 
    
    const success = await sendEmail(email, code);

    if (success) {
        res.json({ message: 'Код отправлен на ваш Email.' });
    } else {
        res.status(500).json({ message: 'Не удалось отправить код верификации.' });
    }
});

// 2. Регистрация и верификация
app.post('/api/register', async (req, res) => {
    // ... (без изменений)
    const { email, code } = req.body;
    const storedData = verificationCodes.get(email);

    if (!storedData || storedData.code !== code) {
        return res.status(400).json({ message: 'Неверный код верификации.' });
    }
    
    try {
        const newUser = new UserModel({
            login: storedData.login,
            email,
            passwordHash: storedData.password, 
            verified: true
        });
        await newUser.save(); 

        verificationCodes.delete(email);

        const token = jwt.sign({ id: newUser._id, login: newUser.login }, JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Регистрация успешна!', token, login: newUser.login });
    } catch (error) {
        console.error("Ошибка при сохранении пользователя:", error);
        res.status(500).json({ message: 'Ошибка сервера при регистрации.' });
    }
});


// 3. Маршрут Входа (Логин)
app.post('/api/login', async (req, res) => {
    // ... (без изменений)
    const { identifier, password } = req.body;

    const user = await UserModel.findOne({ 
        $or: [{ email: identifier }, { login: identifier }] 
    });

    if (!user || user.passwordHash !== password) {
        return res.status(400).json({ message: 'Неверный логин/email или пароль.' });
    }

    const token = jwt.sign({ id: user._id, login: user.login }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ 
        message: 'Вход успешен!', 
        token,
        login: user.login
    });
});


// 4. Загрузка видео 
app.post('/api/upload', authenticateToken, upload.single('video'), async (req, res) => {
    // ... (без изменений)
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
        
        const publicFilePath = newVideo.filePath.replace(/\\/g, '/');

        res.json({ message: 'Видео принято!', title: newVideo.title, isShorts: newVideo.isShorts, filePath: publicFilePath });
    } catch (error) {
        console.error("Ошибка при сохранении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при загрузке видео.' });
    }
});

// 5. *** ИЗМЕНЕНО: Маршрут для отображения списка видео с пагинацией ***
app.get('/api/videos', async (req, res) => {
    // Устанавливаем параметры пагинации
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12; // 12 видео на странице
    const skip = (page - 1) * limit;

    try {
        // Получаем Shorts (без пагинации)
        const shortsVideos = await VideoModel.find({ isShorts: true }, 'title uploaderLogin isShorts uploadDate filePath')
            .sort({ uploadDate: -1 }); // Сортируем по дате загрузки
        
        // Получаем обычные видео (с пагинацией)
        const regularVideosQuery = VideoModel.find({ isShorts: false }, 'title uploaderLogin isShorts uploadDate filePath')
            .sort({ uploadDate: -1 }) // Сортируем по дате загрузки
            .skip(skip)
            .limit(limit);
        
        const regularVideos = await regularVideosQuery.exec();

        // Подсчитываем общее количество обычных видео для пагинации
        const totalRegularVideos = await VideoModel.countDocuments({ isShorts: false });
        const totalPages = Math.ceil(totalRegularVideos / limit);

        const mapVideo = (v) => ({ 
            id: v._id, 
            title: v.title, 
            uploader: v.uploaderLogin,
            isShorts: v.isShorts,
            filePath: v.filePath.replace(/\\/g, '/') 
        });

        res.json({
            shorts: shortsVideos.map(mapVideo),
            regularVideos: regularVideos.map(mapVideo),
            currentPage: page,
            totalPages: totalPages
        });

    } catch (error) {
        console.error("Ошибка при получении видео с пагинацией:", error);
        res.status(500).json({ message: 'Ошибка сервера при получении списка видео.' });
    }
});

// 6. Получение информации об одном видео (для страницы просмотра)
app.get('/api/video/:id', async (req, res) => {
    // ... (без изменений)
    const videoId = req.params.id;

    try {
        const video = await VideoModel.findById(videoId, 'title uploaderLogin filePath isShorts');
        if (!video) {
            return res.status(404).json({ message: 'Видео не найдено.' });
        }
        
        const publicFilePath = video.filePath.replace(/\\/g, '/');

        res.json({ 
            title: video.title,
            uploader: video.uploaderLogin,
            filePath: publicFilePath, 
            isShorts: video.isShorts
        });
        
    } catch (error) {
        console.error("Ошибка при получении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при получении данных видео.' });
    }
});

// 7. Удаление видео (только владельцем)
app.delete('/api/video/:id', authenticateToken, async (req, res) => {
    // ... (без изменений)
    const videoId = req.params.id;
    const userLogin = req.user.login;

    try {
        const video = await VideoModel.findById(videoId);

        if (!video) {
            return res.status(404).json({ message: 'Видео не найдено.' });
        }

        if (video.uploaderLogin !== userLogin) {
            return res.status(403).json({ message: 'Удалить видео может только его владелец.' });
        }

        // 1. Удаляем видеофайл с сервера
        if (video.filePath && video.filePath !== 'simulated_path.mp4') {
            fs.unlink(video.filePath, (err) => {
                if (err) console.error(`[FS ERROR] Не удалось удалить файл ${video.filePath}:`, err);
            });
        }

        // 2. Удаляем запись из базы данных
        await VideoModel.findByIdAndDelete(videoId);

        res.json({ message: 'Видео успешно удалено.' });

    } catch (error) {
        console.error("Ошибка при удалении видео:", error);
        res.status(500).json({ message: 'Ошибка сервера при удалении видео.' });
    }
});


// 8. Удаление аккаунта
app.delete('/api/account', authenticateToken, async (req, res) => {
    // ... (без изменений)
    const userLogin = req.user.login;

    try {
        // Опционально: Удаление всех видео пользователя перед удалением аккаунта
        const videosToDelete = await VideoModel.find({ uploaderLogin: userLogin });
        
        for (const video of videosToDelete) {
             if (video.filePath && video.filePath !== 'simulated_path.mp4') {
                fs.unlink(video.filePath, (err) => {
                    if (err) console.error(`[FS ERROR] Не удалось удалить файл ${video.filePath}:`, err);
                });
             }
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


// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
    console.log(`ИНСТРУКЦИЯ: Откройте http://localhost:${port}/youtube.html`);
});