// ================= 1. INTRO ANIMATION =================
const canvas = document.getElementById('animCanvas');
const ctx = canvas.getContext('2d');
const introOverlay = document.getElementById('intro-overlay');
const mainSite = document.getElementById('main-site');
let animId;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
const colors = ['#ff7675', '#74b9ff', '#55efc4', '#ffeaa7', '#a29bfe', '#fd79a8', '#fab1a0', '#81ecec'];
let balls = [], particles = [], phase = 'rolling', frameCount = 0;

for(let i=0; i < 8; i++) {
    const angle = (i * (Math.PI * 2) / 8);
    const dist = Math.max(window.innerWidth, window.innerHeight) * 0.8;
    balls.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, vx: (cx - (cx + Math.cos(angle) * dist)) / 120, vy: (cy - (cy + Math.sin(angle) * dist)) / 120, color: colors[i % colors.length] });
}

function createExplosion() {
    for (let i = 0; i < 250; i++) {
        const color = balls[Math.floor(Math.random() * balls.length)].color;
        particles.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, radius: Math.random() * 40 + 10, color: color, growthRate: Math.random() * 4 + 3 });
    }
}

function animate() {
    if (phase === 'finished') return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (phase === 'rolling') {
        frameCount++;
        balls.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            ctx.beginPath(); ctx.arc(b.x, b.y, 85, 0, Math.PI * 2); ctx.fillStyle = b.color; ctx.fill();
        });
        if (frameCount >= 120) { phase = 'expanding'; document.querySelector('.skip-hint').style.opacity = '0'; createExplosion(); }
    }
    if (phase === 'expanding') {
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.radius += p.growthRate * 2; p.growthRate *= 1.03; 
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        });
        if (particles[0].radius > Math.max(window.innerWidth, window.innerHeight)) { enterSite(); return; }
    }
    animId = requestAnimationFrame(animate);
}
animate();
setTimeout(() => { if (!isEntered) enterSite(); }, 4000); 

let isEntered = false;
function enterSite() {
    if (isEntered) return;
    isEntered = true; phase = 'finished'; cancelAnimationFrame(animId);
    introOverlay.classList.add('curtain-open');
    mainSite.style.visibility = 'visible'; mainSite.style.opacity = '1';
    document.body.style.overflowY = 'auto'; 
    document.querySelectorAll('.reveal-element').forEach((el, index) => { setTimeout(() => { el.classList.add('reveal-active'); }, 300 + (index * 150)); });
    setTimeout(() => { introOverlay.style.display = 'none'; }, 1500);
}
document.addEventListener('keydown', (e) => { if (e.code === 'Space') enterSite(); });

// ================= SYSTEM LOGIC (API) =================
let currentUser = null; 
let artworks = [];

// Init: Fetch Artworks from Python
async function initSystem() {
    const res = await fetch('/api/artworks');
    artworks = await res.json();
    
    // Check local session just for UI state
    const session = sessionStorage.getItem('as_user');
    if(session) {
        currentUser = JSON.parse(session);
        updateUI();
    }
    
    renderTopArtists();
    renderGallery(artworks);
}

// Auth
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass })
    });
    const data = await res.json();
    if(data.success) loginSuccess(data.user);
    else alert(data.message);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if(data.success) loginSuccess(data.user);
    else alert(data.message);
}

function loginSuccess(user) {
    currentUser = user;
    sessionStorage.setItem('as_user', JSON.stringify(currentUser));
    updateUI();
    closeModal('auth-modal');
}

function updateUI() {
    document.getElementById('guest-nav').classList.add('hidden');
    document.getElementById('user-nav').classList.remove('hidden');
    document.getElementById('user-nav').style.display = 'flex';
    document.getElementById('display-name').innerText = currentUser.name;
    document.getElementById('display-role').innerText = currentUser.role === 'admin' ? 'Administrator' : 'Member';
    
    if(currentUser.role === 'admin') {
        document.getElementById('admin-reset-btn').classList.remove('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminUsers();
    }
}

function logout() {
    if(confirm('ออกจากระบบ?')) {
        currentUser = null;
        sessionStorage.removeItem('as_user');
        location.reload();
    }
}

// Upload & Buy with Files
async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('upTitle').value);
    formData.append('price', document.getElementById('upPrice').value);
    formData.append('category', document.getElementById('upCategory').value);
    formData.append('artist', currentUser.name);
    formData.append('image', document.getElementById('upImage').files[0]);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.success) {
        alert('ลงผลงานสำเร็จ!');
        location.reload();
    }
}

let selectedItemForPay = null;
function openPreview(id) {
    const item = artworks.find(a => a.id === id);
    if(!item) return;
    selectedItemForPay = item;
    
    document.getElementById('modal-img').src = item.img;
    document.getElementById('modal-title').textContent = item.title;
    document.getElementById('modal-artist').textContent = item.artist;
    document.getElementById('modal-price').textContent = `฿${item.price.toLocaleString()}`;
    document.getElementById('modal-desc').innerText = item.caption || "ผลงานชิ้นเอก...";
    
    const btn = document.getElementById('modal-buy-btn');
    const dlBtn = document.getElementById('modal-download-btn');
    const isOwned = currentUser && (item.owner === currentUser.name || item.artist === currentUser.name);

    if(item.isSold) {
        if(isOwned) {
            btn.innerHTML = '<i class="fas fa-check"></i> คุณเป็นเจ้าของแล้ว';
            btn.disabled = true;
            btn.style.background = '#2ed573';
            dlBtn.href = item.img; dlBtn.download = `ArtSpace_${item.title}.jpg`; dlBtn.classList.remove('hidden');
        } else {
            btn.innerHTML = 'สินค้าขายแล้ว'; btn.disabled = true; btn.style.background = '#333'; dlBtn.classList.add('hidden');
        }
    } else {
        if(currentUser && item.artist === currentUser.name) {
            btn.innerHTML = 'ผลงานของคุณ'; btn.disabled = true; btn.style.background = '#b2bec3';
            dlBtn.href = item.img; dlBtn.classList.remove('hidden');
        } else {
            btn.innerHTML = 'ซื้อผลงานนี้'; btn.disabled = false; btn.style.background = 'linear-gradient(90deg, #6c5ce7, #a55eea)'; dlBtn.classList.add('hidden');
        }
    }
    document.getElementById('preview-modal').classList.add('open');
}

function openPayment() {
    if(!currentUser) { alert('กรุณาเข้าสู่ระบบ'); return; }
    closeModal('preview-modal');
    document.getElementById('pay-item-name').textContent = selectedItemForPay.title;
    document.getElementById('pay-amount').value = `฿${selectedItemForPay.price.toLocaleString()}`;
    document.getElementById('payment-modal').classList.add('open');
}

async function confirmPayment(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('id', selectedItemForPay.id);
    formData.append('buyer', currentUser.name);
    formData.append('slip', document.getElementById('pay-slip').files[0]);

    const res = await fetch('/api/buy', { method: 'POST', body: formData });
    const data = await res.json();
    if(data.success) {
        closeModal('payment-modal');
        document.getElementById('success-modal').classList.add('open');
        initSystem(); // Refresh
    }
}

// Edit & Delete
async function deleteArt(id, event) {
    event.stopPropagation();
    if(confirm('ลบผลงานนี้?')) {
        await fetch('/api/delete_art', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        location.reload();
    }
}

function openEditModal(id, event) {
    event.stopPropagation();
    const item = artworks.find(a => a.id === id);
    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-price').value = item.price;
    document.getElementById('edit-caption').value = item.caption;
    document.getElementById('edit-modal').classList.add('open');
}

async function confirmEdit(e) {
    e.preventDefault();
    await fetch('/api/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: document.getElementById('edit-id').value,
            price: document.getElementById('edit-price').value,
            caption: document.getElementById('edit-caption').value
        })
    });
    location.reload();
}

async function deleteAccount() {
    if(confirm('ยืนยันลบบัญชี?')) {
        await fetch('/api/delete_account', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email })
        });
        logout_no_confirm();
    }
}

async function systemReset() {
    if(confirm('รีเซ็ตระบบทั้งหมด?')) {
        await fetch('/api/reset', { method: 'POST' });
        logout_no_confirm();
    }
}

// Helpers
function logout_no_confirm() { sessionStorage.removeItem('as_user'); location.reload(); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openAuthModal(mode='login') { 
    document.getElementById('auth-modal').classList.add('open'); 
    document.getElementById('login-section').classList.toggle('hidden', mode === 'register');
    document.getElementById('register-section').classList.toggle('hidden', mode !== 'register');
}
function toggleAuth(mode) { openAuthModal(mode); }

// Render Logic
function renderGallery(items) {
    const grid = document.getElementById('gallery');
    grid.innerHTML = items.map(item => {
        const canEdit = currentUser && (item.artist === currentUser.name || currentUser.role === 'admin');
        const btns = canEdit ? `<div class="action-btn-group"><button class="action-btn btn-edit" onclick="openEditModal(${item.id}, event)"><i class="fas fa-pencil-alt"></i></button><button class="action-btn btn-delete" onclick="deleteArt(${item.id}, event)"><i class="fas fa-trash"></i></button></div>` : '';
        const soldOverlay = item.isSold ? `<div class="sold-overlay-badge">SOLD</div>` : '';
        const soldClass = item.isSold ? 'sold' : '';
        
        return `<div class="art-card ${soldClass}">
            <div class="card-img-container" onclick="openPreview(${item.id})">
                <span class="category-badge">${item.category}</span> ${soldOverlay} ${btns}
                <div class="card-overlay"><span class="view-btn">ดูรายละเอียด</span></div>
                <img src="${item.img}" class="card-img">
            </div>
            <div class="card-body">
                <h4 class="card-title">${item.title}</h4>
                <div style="font-size:13px; color:#a0a0b0;">${item.artist}</div>
                <div class="card-price">฿${item.price.toLocaleString()}</div>
            </div>
        </div>`;
    }).join('');
}

function renderTopArtists() {
    const sorted = [...artworks].sort((a,b) => b.sales - a.sales).slice(0,3);
    document.getElementById('top-artists-grid').innerHTML = sorted.map((a,i) => `
        <div class="artist-rank-card"><div class="rank-badge">${i+1}</div><img src="${a.img}" class="artist-img"><div class="artist-name">${a.artist}</div><div class="artist-sales">ขายแล้ว ${a.sales} ชิ้น</div></div>
    `).join('');
}

// Admin Panel
async function loadAdminUsers() {
    const res = await fetch('/api/users');
    const users = await res.json();
    document.getElementById('user-list-container').innerHTML = users.map(u => `
        <div class="admin-user-row"><span>👤 ${u.name} (${u.email}) - ${u.role}</span> ${u.role !== 'admin' ? `<button onclick="adminDeleteUser('${u.email}')" style="color:red; border:none; background:none;">ลบ</button>` : ''}</div>
    `).join('');
}

async function adminDeleteUser(email) {
    if(confirm('ลบผู้ใช้นี้?')) {
        await fetch('/api/delete_user', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        loadAdminUsers();
    }
}

// Studio Tabs
function openMyStudio() {
    if(!currentUser) return;
    document.getElementById('top-artists-section').classList.add('hidden');
    document.getElementById('studio-panel').classList.remove('hidden');
    switchStudioTab('upload');
}
function switchStudioTab(tab) {
    document.querySelectorAll('.studio-tab').forEach(t => t.classList.remove('active'));
    if(tab === 'upload') {
        document.getElementById('tab-upload').classList.add('active');
        document.getElementById('upload-form').classList.remove('hidden');
        document.getElementById('collection-msg').classList.add('hidden');
        renderGallery(artworks.filter(a => a.artist === currentUser.name));
    } else {
        document.getElementById('tab-collection').classList.add('active');
        document.getElementById('upload-form').classList.add('hidden');
        document.getElementById('collection-msg').classList.remove('hidden');
        renderGallery(artworks.filter(a => a.owner === currentUser.name && a.isSold));
    }
}
function filterGallery(cat, btn) {
    document.getElementById('studio-panel').classList.add('hidden');
    document.getElementById('top-artists-section').classList.remove('hidden');
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    if(cat === 'all') renderGallery(artworks);
    else if(cat === 'sold') renderGallery(artworks.filter(a => a.isSold));
    else renderGallery(artworks.filter(a => a.category === cat));
}

function searchGallery() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    renderGallery(artworks.filter(a => a.title.toLowerCase().includes(term) || a.artist.toLowerCase().includes(term)));
}
function resetView() { location.reload(); }

initSystem();