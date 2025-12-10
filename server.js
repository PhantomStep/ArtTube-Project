// server.js

// ВАЖНО: Убедитесь, что ваши секреты читаются из Render
const DB_URI = process.env.DB_URI;
const SENDER_PASS = process.env.SENDER_PASS; 
const JWT_SECRET = process.env.JWT_SECRET;
const port = process.env.PORT || 3000; 

// ЭТО КРИТИЧЕСКИ ВАЖНО для загрузки страницы и скриптов
app.use(express.static(__dirname)); 

// ЭТО КРИТИЧЕСКИ ВАЖНО для отображения youtube.html по адресу сайта
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'youtube.html'));
});

app.listen(port, () => {
    console.log(`Сервер запущен и слушает порт ${port}`);
});
