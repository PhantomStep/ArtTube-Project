// youtube.js - ФИНАЛЬНАЯ СТАБИЛЬНАЯ ВЕРСИЯ (Исправлено)

// Объявление переменных в глобальной области
let registerForm, uploadSection, uploadForm, regCodeInput, registerButton, codeMessage, authForm, videoFeed, shortsFeed, videoPage, loginForm, videoPlayer;
let deleteAccountContainer, deleteVideoBtn, paginationControls, prevPageBtn, nextPageBtn, paginationInfo;
let recommendationsList;

let currentLogin = '';
let currentVideoId = null; 
let currentUploader = null; 
let currentPage = 1; 
let totalPages = 1;  
let allLoadedVideos = []; // Хранилище всех загруженных видео (для рекомендаций)

// --- 1. ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ЭЛЕМЕНТОВ (Критически важно для устранения ошибок) ---
function init() {
    // ЭЛЕМЕНТЫ ФОРМ И КНОПОК
    registerForm = document.getElementById('register-form');
    uploadSection = document.getElementById('upload-section');
    uploadForm = document.getElementById('upload-form');
    regCodeInput = document.getElementById('reg-code');
    registerButton = document.getElementById('register-btn');
    codeMessage = document.getElementById('code-message');
    authForm = document.getElementById('auth-form');
    loginForm = document.getElementById('login-form'); 
    deleteAccountContainer = document.getElementById('delete-account-container'); 
    deleteVideoBtn = document.getElementById('delete-video-btn'); 
    
    // ЭЛЕМЕНТЫ ЛЕНТЫ И ПАГИНАЦИИ
    videoFeed = document.getElementById('video-feed');
    shortsFeed = document.getElementById('shorts-feed'); 
    paginationControls = document.getElementById('pagination-controls');
    prevPageBtn = document.getElementById('prev-page-btn');
    nextPageBtn = document.getElementById('next-page-btn');
    paginationInfo = document.getElementById('pagination-info');
    
    // ЭЛЕМЕНТЫ СТРАНИЦЫ ПРОСМОТРА
    videoPage = document.getElementById('video-page');     
    videoPlayer = document.getElementById('video-player'); 
    recommendationsList = document.getElementById('recommendations-list'); 

    // Добавление обработчиков событий
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);

    checkAuthAndLoad(); // Запуск проверки авторизации и первой загрузки видео
}

// --- Вспомогательные функции ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function decodeTokenPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// --- Управление интерфейсом и Статусом ---

function checkAuthAndLoad() {
    const userToken = localStorage.getItem('userToken');
    if (userToken) {
        const payload = decodeTokenPayload(userToken);
        if (payload && payload.login) {
            updateAuthStatus(true, payload.login);
            // Если пользователь залогинен, загружаем видео с 1-й страницы
            loadVideos(currentPage); 
            return;
        }
    } 
    // Если пользователь не залогинен или токен недействителен, загружаем видео с 1-й страницы
    updateAuthStatus(false);
    loadVideos(currentPage); 
}

function updateAuthStatus(isLoggedIn, username = '') {
    const authStatus = document.getElementById('auth-status');
    currentLogin = username;
    
    if (isLoggedIn) {
        authStatus.innerHTML = `<p style="margin-right: 15px;">Вы вошли как: <b>${username}</b>.</p> <button onclick="logout()">Выйти</button>`;
        if (uploadSection) uploadSection.classList.remove('hidden'); 
        if (authForm) authForm.classList.add('hidden');
        if (deleteAccountContainer) deleteAccountContainer.classList.remove('hidden'); 
    } else {
        authStatus.innerHTML = `<p style="margin-right: 15px;">Вы не вошли в систему.</p> <button onclick="showAuth()">Войти</button>`;
        if (uploadSection) uploadSection.classList.add('hidden'); 
        if (deleteAccountContainer) deleteAccountContainer.classList.add('hidden'); 
    }
}

function showAuth() {
    if (authForm) authForm.classList.remove('hidden');
    // Скрываем ленту, чтобы было видно форму
    if (shortsFeed) shortsFeed.classList.add('hidden');
    if (videoFeed) videoFeed.classList.add('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); 
}

function logout() {
    localStorage.removeItem('userToken');
    currentLogin = '';
    updateAuthStatus(false);
    // После выхода показываем ленту
    if (shortsFeed) shortsFeed.classList.remove('hidden');
    if (videoFeed) videoFeed.classList.remove('hidden');
    if (videoPage && !videoPage.classList.contains('hidden')) {
        hideVideoPage();
    } else {
        loadVideos(1); // Загружаем первую страницу
    }
}

// --- 2. ОБРАБОТЧИКИ ФОРМ (без изменений) ---

async function handleLogin(e) {
    e.preventDefault();
    
    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userToken', data.token);
            updateAuthStatus(true, data.login); 
            loginForm.reset();
            // Показываем ленту после входа
            if (shortsFeed) shortsFeed.classList.remove('hidden');
            if (videoFeed) videoFeed.classList.remove('hidden');
        } else {
            alert(`Ошибка входа: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при входе.');
    }
}

async function sendVerificationCode() {
    const login = document.getElementById('reg-login').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!login || !email || !password) {
        alert('Заполните все поля для регистрации.');
        return;
    }

    try {
        const response = await fetch('/api/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            if(codeMessage) codeMessage.textContent = data.message + ' Теперь введите код.';
            if(regCodeInput) regCodeInput.classList.remove('hidden');
            if(registerButton) registerButton.classList.remove('hidden');
        } else {
            alert(`Ошибка: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при отправке кода.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const code = document.getElementById('reg-code').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        
        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('userToken', data.token);
            updateAuthStatus(true, data.login); 
            alert('Регистрация успешна! Вы вошли в аккаунт.');
            
            // Скрываем форму регистрации/входа
            if (authForm) authForm.classList.add('hidden');
            // Сбрасываем и очищаем поля регистрации
            if (registerForm) registerForm.reset();
            if (regCodeInput) regCodeInput.classList.add('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (codeMessage) codeMessage.textContent = '';
            
            // Показываем ленту после регистрации
            if (shortsFeed) shortsFeed.classList.remove('hidden');
            if (videoFeed) videoFeed.classList.remove('hidden');

        } else {
            alert(`Ошибка регистрации: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при регистрации.');
    }
}


// --- 3. ЛОГИКА ЗАГРУЗКИ ВИДЕО (без изменений, кроме вызова loadVideos) ---

async function handleUpload(e) {
    e.preventDefault();

    const title = document.getElementById('video-title').value;
    const fileInput = document.getElementById('video-file');
    const isShorts = document.getElementById('is-shorts') ? document.getElementById('is-shorts').checked : false; 
    const token = localStorage.getItem('userToken');

    if (!token) {
        alert('Вы не вошли в систему. Войдите, чтобы загрузить видео.');
        return;
    }
    
    if (fileInput.files.length === 0) {
        alert('Пожалуйста, выберите файл для загрузки.');
        return;
    }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('video', fileInput.files[0]); 
    formData.append('isShorts', isShorts.toString()); 

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Видео успешно опубликовано: "${data.title}" (Shorts: ${data.isShorts ? 'Да' : 'Нет'})`);
            uploadForm.reset();
            loadVideos(currentPage); // Обновляем текущую страницу
        } else {
            alert(`Ошибка загрузки: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при загрузке видео.');
    }
}

// --- 4. ЛОГИКА ОТОБРАЖЕНИЯ ВИДЕО И ПАГИНАЦИЯ ---

function renderVideoCard(video, isShorts) {
    const card = document.createElement('div');
    card.className = isShorts ? 'shorts-card' : 'video-card';
    card.onclick = () => showVideoPage(video.id); 
    
    const thumbnailClass = isShorts ? 'shorts-card-thumbnail' : 'video-card-thumbnail';
    const titleTag = isShorts ? 'h4' : 'h3';
    
    card.innerHTML = `
        <div class="${thumbnailClass}">
            <p>${isShorts ? 'Short' : 'Видео'}</p>
        </div>
        <${titleTag}>${video.title}</${titleTag}>
        <p>Автор: ${video.uploader}</p>
    `;
    return card;
}


function renderVideos(response) {
    const { shorts, regularVideos, currentPage: page, totalPages: total } = response;
    
    allLoadedVideos = [...shorts, ...regularVideos];
    
    // 1. РЕНДЕРИНГ SHORTS 
    if (shortsFeed) shortsFeed.innerHTML = '<h2>⚡ Shorts</h2>';
    if (shorts.length > 0) {
        shorts.forEach(video => {
            if (shortsFeed) shortsFeed.appendChild(renderVideoCard(video, true));
        });
    } else {
         if (shortsFeed) shortsFeed.innerHTML += '<p style="color: var(--secondary-text);">Пока нет Shorts.</p>';
    }

    // 2. РЕНДЕРИНГ ОБЫЧНЫХ ВИДЕО 
    if (videoFeed) videoFeed.innerHTML = '<h2>▶ Рекомендации для вас</h2>';
    if (regularVideos.length > 0) {
        regularVideos.forEach(video => {
            if (videoFeed) videoFeed.appendChild(renderVideoCard(video, false));
        });
    } else {
        if (videoFeed) videoFeed.innerHTML += '<p style="color: var(--secondary-text);">Пока нет длинных видео на этой странице.</p>';
    }
    
    // 3. ОБНОВЛЕНИЕ ПАГИНАЦИИ
    currentPage = page;
    totalPages = total;
    updatePaginationControls();
}

function updatePaginationControls() {
    if (paginationControls) {
        if (totalPages > 1) {
            paginationControls.classList.remove('hidden');
        } else {
            paginationControls.classList.add('hidden');
            return;
        }

        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
        if (paginationInfo) paginationInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
    }
}

async function loadVideos(page = 1) {
    if (videoFeed) videoFeed.innerHTML = '<h2>▶ Рекомендации для вас</h2><p>Загрузка видео...</p>';
    if (shortsFeed) shortsFeed.innerHTML = '<h2>⚡ Shorts</h2><p>Загрузка Shorts...</p>';
    if (paginationControls) paginationControls.classList.add('hidden'); 

    try {
        const response = await fetch(`/api/videos?page=${page}`);
        if (!response.ok) {
             throw new Error('Server returned error: ' + response.status);
        }
        const data = await response.json();
        renderVideos(data);
        window.scrollTo(0, 0); 
        // Если видео загрузились, показываем ленту
        if (shortsFeed) shortsFeed.classList.remove('hidden');
        if (videoFeed) videoFeed.classList.remove('hidden');

    } catch (error) {
        if (videoFeed) videoFeed.innerHTML = '<p style="color: red;">Не удалось загрузить список видео. Убедитесь, что сервер запущен.</p>';
        if (shortsFeed) shortsFeed.innerHTML = '';
        console.error('Ошибка загрузки видео:', error);
    }
}

function changePage(newPage) {
    if (newPage >= 1 && newPage <= totalPages) {
        loadVideos(newPage);
    }
}

// --- 5. ЛОГИКА ПРОСМОТРА И УДАЛЕНИЯ ВИДЕО ---

function renderRecommendations(currentId) {
    if (!recommendationsList) return;
    
    const filteredVideos = allLoadedVideos.filter(v => v.id !== currentId);
    const recommendedVideos = shuffleArray(filteredVideos).slice(0, 8); 
    
    recommendationsList.innerHTML = '';
    
    if (recommendedVideos.length === 0) {
        recommendationsList.innerHTML = '<p style="color: var(--secondary-text); font-size: 14px;">Нет других видео для рекомендаций.</p>';
        return;
    }

    recommendedVideos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        card.onclick = () => showVideoPage(video.id); 
        
        card.innerHTML = `
            <div class="rec-thumbnail">
                ${video.isShorts ? 'Short' : 'Видео'}
            </div>
            <div class="rec-info">
                <h4>${video.title}</h4>
                <p>${video.uploader}</p>
            </div>
        `;
        recommendationsList.appendChild(card);
    });
}

function hideVideoPage() {
    if (videoPlayer) {
        videoPlayer.pause(); 
        videoPlayer.src = ""; 
    }
    if (videoPage) videoPage.classList.add('hidden');
    if (shortsFeed) shortsFeed.classList.remove('hidden');
    if (videoFeed) videoFeed.classList.remove('hidden');
    if (paginationControls && totalPages > 1) paginationControls.classList.remove('hidden'); 
    currentVideoId = null;
    currentUploader = null;
    loadVideos(currentPage); 
}

async function showVideoPage(videoId) {
    currentVideoId = videoId;
    if (authForm) authForm.classList.add('hidden'); // Скрываем форму входа/регистрации, если она была открыта
    if (shortsFeed) shortsFeed.classList.add('hidden');
    if (videoFeed) videoFeed.classList.add('hidden');
    if (paginationControls) paginationControls.classList.add('hidden'); 
    if (videoPage) videoPage.classList.remove('hidden');
    
    const token = localStorage.getItem('userToken');
    
    try {
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`/api/video/${videoId}`, { headers });
        
        if (!response.ok) throw new Error('Ошибка загрузки данных видео');
        
        const video = await response.json();
        
        currentUploader = video.uploader;
        
        document.getElementById('video-title-display').textContent = video.title;
        document.getElementById('video-uploader-display').textContent = video.uploader;
        
        if (videoPlayer) {
            const publicUrl = `/${video.filePath}`; 
            videoPlayer.src = publicUrl; 
            
            if (video.isShorts) {
                 videoPlayer.classList.add('shorts-player');
                 videoPlayer.loop = true; 
            } else {
                 videoPlayer.classList.remove('shorts-player');
                 videoPlayer.loop = false;
            }
            
            videoPlayer.play().catch(error => {
                console.warn('Автоматическое воспроизведение заблокировано браузером. Нажмите Play.', error);
            });
        }
        
        updateDeleteButtonVisibility(video.uploader);
        renderRecommendations(videoId);

    } catch (error) {
        alert('Не удалось загрузить видео: ' + error.message);
        hideVideoPage();
    }
}

function updateDeleteButtonVisibility(uploader) {
    if (deleteVideoBtn) {
        if (currentLogin && currentLogin === uploader) {
            deleteVideoBtn.classList.remove('hidden');
        } else {
            deleteVideoBtn.classList.add('hidden');
        }
    }
}

async function deleteVideo() {
    if (!currentVideoId) return;

    if (!confirm('Вы уверены, что хотите удалить это видео? Это действие нельзя отменить.')) {
        return;
    }
    
    const token = localStorage.getItem('userToken');
    if (!token) return alert('Ошибка аутентификации.');

    try {
        const response = await fetch(`/api/video/${currentVideoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            hideVideoPage(); 
        } else {
            alert(`Ошибка удаления: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при удалении видео.');
    }
}


async function deleteAccount() {
    if (!currentLogin) return;

    if (!confirm(`Вы уверены, что хотите безвозвратно удалить аккаунт "${currentLogin}" и все загруженные видео?`)) {
        return;
    }
    
    const token = localStorage.getItem('userToken');
    if (!token) return alert('Ошибка аутентификации.');

    try {
        const response = await fetch('/api/account', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            logout(); 
            if (authForm) authForm.classList.remove('hidden');
        } else {
            alert(`Ошибка удаления аккаунта: ${data.message || response.statusText}`);
        }
    } catch (error) {
        alert('Ошибка сети при удалении аккаунта.');
    }
}


// Делаем функции глобальными, чтобы они работали из HTML
window.showAuth = showAuth; 
window.sendVerificationCode = sendVerificationCode;
window.logout = logout;
window.hideVideoPage = hideVideoPage;
window.deleteVideo = deleteVideo; 
window.deleteAccount = deleteAccount; 
window.changePage = changePage; 
window.showVideoPage = showVideoPage; 

// Запуск инициализации после загрузки DOM
document.addEventListener('DOMContentLoaded', init);