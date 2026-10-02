// === CORE DATA & STATE MANAGEMENT ===
const defaultState = {
    stats: { hp: 100, maxHp: 100, gold: 0, xp: 0, rank: "Rebahan Warrior", lvl: 1, name: "Andra" },
    settings: { notificationType: "GABUNGAN" },
    quests: [
        { id: 1, title: "[P1] Bangun & Sholat Subuh", startTime: "04:30", endTime: "05:15", description: "Tulis deskripsi tes panjang di sini...", isWajib: true, gold: 30, xp: 30, status: "AVAILABLE" },
        { id: 2, title: "[P1] 🏋️ Stretching Ringan", startTime: "05:15", endTime: "05:30", isWajib: true, gold: 10, xp: 10, status: "AVAILABLE" },
        { id: 3, title: "[P2] 💼 Blok Produktif Siang", startTime: "08:00", endTime: "11:30", isWajib: false, gold: 40, xp: 40, status: "AVAILABLE" },
        { id: 4, title: "[P3] 😴 Power Nap 20 Menit", startTime: "13:00", endTime: "13:20", isWajib: false, gold: 10, xp: 10, status: "AVAILABLE" },
        { id: 5, title: "[P1] 🌙 Review Malam & Tidur", startTime: "21:30", endTime: "22:00", isWajib: true, gold: 20, xp: 20, status: "AVAILABLE" }
    ],
    sideQuests: [
        { id: 101, title: "Minum air putih 2 liter", gold: 5, xp: 5, status: "AVAILABLE" },
        { id: 102, title: "Push-up 10x", gold: 5, xp: 5, status: "AVAILABLE" }
    ],
    lastPlayDate: new Date().toLocaleDateString()
};

let playerState = JSON.parse(localStorage.getItem('myquest_data')) || JSON.parse(JSON.stringify(defaultState));

// Keamanan pembaruan data untuk pemain lama (Mencegah error tas kosong)
if (!playerState.inventory) playerState.inventory = { potion: 0, game: 0 };
if (!playerState.buffs) playerState.buffs = { gameModeUntil: null };

// Save data safely
function saveToStorage() {
    localStorage.setItem('myquest_data', JSON.stringify(playerState));
    updateUIStats();
}

// === UI NAVIGATION & RENDERERS ===
function switchTab(tabId, btnElement) {
    if(btnElement) {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active', 'bg-slate-700', 'text-white'));
        btnElement.classList.add('active');
    }
    document.querySelectorAll('.view-section').forEach(view => view.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    document.getElementById('scroll-container').scrollTo(0, 0);
}

function updateUIStats() {
    // Cap HP
    playerState.stats.hp = Math.min(playerState.stats.hp, playerState.stats.maxHp);
    playerState.stats.hp = Math.max(playerState.stats.hp, 0);

    const xpNeeded = playerState.stats.lvl * 100;

    // Update DOM elements
    const uiName = document.getElementById('ui-name');
    if(uiName) uiName.innerText = playerState.stats.name;
    
    const uiRank = document.getElementById('ui-rank');
    if(uiRank) uiRank.innerText = playerState.stats.rank;
    
    const uiHpTxt = document.getElementById('ui-hp-txt');
    if(uiHpTxt) uiHpTxt.innerText = `${playerState.stats.hp}/${playerState.stats.maxHp}`;
    
    const uiHpBar = document.getElementById('ui-hp-bar');
    if(uiHpBar) uiHpBar.style.width = `${(playerState.stats.hp / playerState.stats.maxHp) * 100}%`;
    
    const uiXpTxt = document.getElementById('ui-xp-txt');
    if(uiXpTxt) uiXpTxt.innerText = `${playerState.stats.xp}/${xpNeeded}`;
    
    const uiXpBar = document.getElementById('ui-xp-bar');
    if(uiXpBar) uiXpBar.style.width = `${(playerState.stats.xp / xpNeeded) * 100}%`;
    
    const uiGold = document.getElementById('ui-gold');
    if(uiGold) uiGold.innerText = playerState.stats.gold;
    
    const uiLvl = document.getElementById('ui-lvl');
    if(uiLvl) uiLvl.innerText = `Lvl. ${playerState.stats.lvl}`;

    // Update Indikator Buff Game Mode
    const buffIndicator = document.getElementById('ui-buff-indicator');
    if (buffIndicator) {
        if (playerState.buffs && playerState.buffs.gameModeUntil && Date.now() < playerState.buffs.gameModeUntil) {
            buffIndicator.classList.remove('hidden');
        } else {
            buffIndicator.classList.add('hidden');
        }
    }

    checkGameOver();
}

function renderTimeline() {
    const container = document.getElementById('timeline-container');
    const blocks = container.querySelectorAll('.quest-block, .time-label');
    blocks.forEach(b => b.remove());

    for (let i = 0; i <= 24; i++) {
        const label = document.createElement('div');
        label.className = 'time-label absolute text-[10px] text-slate-500 font-mono';
        label.style.top = `${i * 120 - 7}px`;
        label.style.left = `-35px`;
        label.innerText = `${i.toString().padStart(2, '0')}:00`;
        container.appendChild(label);
    }

    let events = playerState.quests.map(quest => {
        const [sH, sM] = quest.startTime.split(':').map(Number);
        const [eH, eM] = quest.endTime.split(':').map(Number);
        return {
            quest: quest,
            start: (sH * 60) + sM,
            end: (eH * 60) + eM,
            col: 0,
            maxCol: 1
        };
    });

    events.sort((a, b) => a.start - b.start);

    // 3. Algoritma Overlap
    let clusters = [];
    let currentCluster = [];
    let clusterEnd = 0;

    events.forEach(ev => {
        if (currentCluster.length > 0 && ev.start >= clusterEnd) {
            clusters.push(currentCluster);
            currentCluster = [];
            clusterEnd = 0;
        }
        currentCluster.push(ev);
        clusterEnd = Math.max(clusterEnd, ev.end);
    });
    if (currentCluster.length > 0) clusters.push(currentCluster);

    let globalMaxCol = 1; // Variabel baru pelacak tumpukan maksimal

    clusters.forEach(cluster => {
        let columns = [];
        cluster.forEach(ev => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                let lastEventInCol = columns[i][columns[i].length - 1];
                if (lastEventInCol.end <= ev.start) {
                    columns[i].push(ev);
                    ev.col = i;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([ev]);
                ev.col = columns.length - 1;
            }
        });
        cluster.forEach(ev => { 
            ev.maxCol = columns.length; 
            if (columns.length > globalMaxCol) globalMaxCol = columns.length; // Catat tumpukan terbanyak
        });
    });

    // ATUR LEBAR MINIMUM TIMELINE
    // Setiap tumpukan butuh minimal 140px agar teks tetap terbaca
    container.style.minWidth = `max(100%, ${globalMaxCol * 140}px)`;

    // 4. Render Blok
    events.forEach(ev => {
        const quest = ev.quest;
        const topPos = ev.start * 2;
        const height = (ev.end - ev.start) * 2;

        const block = document.createElement('div');
        let bgClass = "bg-cardbg border-slate-600 hover:border-slate-400 hover:bg-slate-700";
        let borderClass = quest.isWajib ? "border-l-rpghp" : "border-l-rpgpurple";

        if (quest.status === 'DONE') {
            bgClass = "bg-emerald-900/20 border-slate-700 opacity-70 hover:opacity-100";
            borderClass = "border-l-emerald-500";
        } else if (quest.status === 'FAILED') {
            bgClass = "bg-red-900/20 border-red-900/50 opacity-80 hover:opacity-100";
            borderClass = "border-l-red-500";
        }

        const isCompact = height <= 45; 
        const isLarge = height >= 80;

        const layoutClass = isCompact ? "flex-row items-center px-2 py-1" : "flex-col justify-start gap-0.5 px-3 py-2";

        block.className = `quest-block absolute border border-l-4 ${bgClass} ${borderClass} rounded-r-lg ${layoutClass} shadow-md overflow-hidden transition-all cursor-pointer z-10 hover:z-30 hover:scale-[1.02]`;
        
        block.style.top = `${topPos}px`;
        block.style.height = `${Math.max(height, 30)}px`; 

        const gap = 1; 
        const widthPercent = (96 / ev.maxCol) - (gap * (ev.maxCol - 1) / ev.maxCol);
        const leftPercent = 2 + (ev.col * (widthPercent + gap));
        
        block.style.left = `${leftPercent}%`;
        block.style.width = `${widthPercent}%`;

        block.onclick = () => openQuestDetail(quest.id);

        const dailyIcon = quest.isDaily ? '<i class="ph-bold ph-arrows-clockwise text-blue-400" title="Misi Harian"></i>' : '';

        if (isCompact) {
            block.innerHTML = `
                <div class="font-bold text-[10px] md:text-xs text-white truncate w-full flex items-center gap-1.5" title="${quest.title}">
                    <span class="truncate max-w-[45%] md:max-w-[55%]">${quest.title}</span>
                    <span class="text-slate-400 font-normal shrink-0 flex items-center gap-1"><i class="ph ph-clock text-rpgpurple"></i> ${quest.startTime} - ${quest.endTime} ${dailyIcon}</span>
                    ${quest.status === 'DONE' ? '<span class="text-emerald-500 font-bold shrink-0">SELESAI</span>' : ''}
                    ${quest.status === 'FAILED' ? '<span class="text-red-500 font-bold shrink-0">GAGAL</span>' : ''}
                </div>
            `;
        } else if (isLarge) {
            block.innerHTML = `
                <div class="font-bold text-xs md:text-sm text-white truncate w-full" title="${quest.title}">${quest.title}</div>
                ${quest.description ? `<div class="text-[10px] text-slate-400 truncate w-full italic" title="${quest.description}">${quest.description}</div>` : ''}
                
                <div class="mt-auto flex flex-col gap-1 w-full overflow-hidden">
                    <div class="text-[9px] md:text-[10px] text-slate-400 flex items-center gap-1.5 truncate w-full">
                        <span class="shrink-0 flex items-center gap-1"><i class="ph ph-clock text-rpgpurple"></i> ${quest.startTime} - ${quest.endTime} ${dailyIcon}</span>
                        ${quest.status === 'DONE' ? '<span class="text-emerald-500 font-bold shrink-0">SELESAI</span>' : ''}
                        ${quest.status === 'FAILED' ? '<span class="text-red-500 font-bold shrink-0">GAGAL</span>' : ''}
                    </div>
                    <div class="text-[9px] md:text-[10px] font-bold flex items-center gap-2 truncate w-full">
                        <span class="text-rpggold shrink-0 flex items-center gap-0.5"><i class="ph-fill ph-coin"></i> ${quest.gold}</span>
                        <span class="text-rpgxp shrink-0 flex items-center gap-0.5"><i class="ph-fill ph-sparkle"></i> ${quest.xp}</span>
                    </div>
                </div>
            `;
        } else {
            block.innerHTML = `
                <div class="font-bold text-xs md:text-sm text-white truncate w-full" title="${quest.title}">${quest.title}</div>
                ${quest.description ? `<div class="text-[10px] text-slate-400 truncate w-full italic" title="${quest.description}">${quest.description}</div>` : ''}
                <div class="text-[9px] md:text-[10px] text-slate-400 mt-auto flex items-center gap-1.5 truncate w-full">
                    <span class="shrink-0 flex items-center gap-1"><i class="ph ph-clock text-rpgpurple"></i> ${quest.startTime} - ${quest.endTime} ${dailyIcon}</span>
                    ${quest.status === 'DONE' ? '<span class="text-emerald-500 font-bold shrink-0">SELESAI</span>' : ''}
                    ${quest.status === 'FAILED' ? '<span class="text-red-500 font-bold shrink-0">GAGAL</span>' : ''}
                </div>
            `;
        }
        
        container.appendChild(block);
    });
}

let activeQuestInterval = null;

function openQuestDetail(id) {
    const quest = playerState.quests.find(q => q.id === id);
    if (!quest) return;

    clearInterval(activeQuestInterval);

    document.getElementById('detail-title').innerText = quest.title;
    document.getElementById('detail-gold').innerText = quest.gold;
    document.getElementById('detail-xp').innerText = quest.xp;
    
    const timeEl = document.getElementById('detail-time');
    const timerContainer = document.getElementById('detail-timer-container');
    const timerCircle = document.getElementById('detail-timer-circle');
    const timerText = document.getElementById('detail-timer-text');
    
    let extraIcon = quest.isDaily ? '<i class="ph-bold ph-arrows-clockwise text-blue-400 ml-1" title="Misi Harian"></i>' : '';
    timeEl.innerHTML = `${quest.startTime} - ${quest.endTime} ${extraIcon}`;

    const now = new Date();
    const currentString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    if(timerCircle) {
        timerCircle.className = "transition-all duration-1000 ease-linear text-emerald-400";
        timerText.className = "text-sm font-bold text-emerald-400 font-mono tracking-tighter";
    }
    
    if (quest.status === 'AVAILABLE' && currentString >= quest.startTime && currentString < quest.endTime && timerCircle) {
        
        timerContainer.classList.remove('hidden');
        timerContainer.classList.add('flex');

        const [startH, startM] = quest.startTime.split(':').map(Number);
        const [endH, endM] = quest.endTime.split(':').map(Number);
        
        const startDate = new Date(); startDate.setHours(startH, startM, 0, 0);
        const endDate = new Date(); endDate.setHours(endH, endM, 0, 0);
        const totalDuration = endDate - startDate;

        const updateTimer = () => {
            const diff = endDate - new Date();
            
            timerCircle.classList.remove('text-emerald-400', 'text-amber-400', 'text-red-500');
            timerText.classList.remove('text-emerald-400', 'text-amber-400', 'text-red-500', 'text-red-400', 'text-[10px]');
            
            if (diff <= 0) {
                timerText.innerHTML = `HABIS`;
                timerText.classList.add('text-red-500', 'text-[10px]');
                timerCircle.style.strokeDashoffset = 264; 
                timerCircle.classList.add('text-red-500');
                clearInterval(activeQuestInterval);
                return;
            }
            
            const hLeft = Math.floor(diff / 3600000);
            const mLeft = Math.floor((diff % 3600000) / 60000);
            const sLeft = Math.floor((diff % 60000) / 1000);
            
            if (hLeft > 0) {
                timerText.innerText = `${hLeft}:${mLeft.toString().padStart(2, '0')}:${sLeft.toString().padStart(2, '0')}`;
            } else {
                timerText.innerText = `${mLeft.toString().padStart(2, '0')}:${sLeft.toString().padStart(2, '0')}`;
            }
            
            const percentLeft = diff / totalDuration;
            const offset = 264 - (percentLeft * 264);
            timerCircle.style.strokeDashoffset = offset;
            
            if (percentLeft > 0.5) {
                timerCircle.classList.add('text-emerald-400');
                timerText.classList.add('text-emerald-400', 'text-sm');
            } else if (percentLeft > 0.15) {
                timerCircle.classList.add('text-amber-400');
                timerText.classList.add('text-amber-400', 'text-sm');
            } else {
                timerCircle.classList.add('text-red-500');
                timerText.classList.add('text-red-500', 'text-sm');
            }
        };
        
        updateTimer(); 
        activeQuestInterval = setInterval(updateTimer, 1000);
        
    } else if(timerContainer) {
        timerContainer.classList.add('hidden');
        timerContainer.classList.remove('flex');
    }

    const descContainer = document.getElementById('detail-desc-container');
    if(quest.description) {
        document.getElementById('detail-desc').innerText = quest.description;
        descContainer.classList.remove('hidden');
    } else {
        descContainer.classList.add('hidden');
    }

    const wajibBadge = document.getElementById('detail-wajib');
    if(quest.isWajib) wajibBadge.classList.remove('hidden');
    else wajibBadge.classList.add('hidden');
    
    const statusBadge = document.getElementById('detail-status-badge');
    const btnComplete = document.getElementById('btn-detail-complete');
    
    if(quest.status === 'AVAILABLE') {
        statusBadge.innerText = 'TERSEDIA';
        statusBadge.className = 'text-[10px] font-bold px-2 py-1 rounded-full bg-blue-900/50 text-blue-300 border border-blue-700 mb-2 inline-block';
        btnComplete.style.display = 'flex';
        btnComplete.onclick = () => { 
            closeQuestDetail(); 
            setTimeout(() => completeMainQuest(id), 300);
        };
    } else if (quest.status === 'DONE') {
        statusBadge.innerText = 'SELESAI';
        statusBadge.className = 'text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700 mb-2 inline-block';
        btnComplete.style.display = 'none';
    } else if (quest.status === 'FAILED') {
        statusBadge.innerText = 'GAGAL';
        statusBadge.className = 'text-[10px] font-bold px-2 py-1 rounded-full bg-red-900/50 text-red-300 border border-red-700 mb-2 inline-block';
        btnComplete.style.display = 'none';
    }

    document.getElementById('btn-detail-delete').onclick = () => { 
        closeQuestDetail(); 
        setTimeout(() => openDeleteModal(id, 'main'), 300); 
    };

    const modal = document.getElementById('modal-quest-detail');
    const modalContent = document.getElementById('modal-quest-detail-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeQuestDetail() {
    clearInterval(activeQuestInterval);
    const modal = document.getElementById('modal-quest-detail');
    const modalContent = document.getElementById('modal-quest-detail-content');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

let pendingQuestId = null;

function completeMainQuest(id) {
    const quest = playerState.quests.find(q => q.id === id);
    if (quest && quest.status === 'AVAILABLE') {
        
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        const currentString = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;

        if (currentString < quest.startTime || currentString > quest.endTime) {
            document.getElementById('warning-message').innerText = `Misi ini tidak bisa dikerjakan sekarang.\nKerjakan di antara jam ${quest.startTime} - ${quest.endTime}.`;
            const warningModal = document.getElementById('modal-warning');
            const warningContent = document.getElementById('modal-warning-content');
            warningModal.classList.remove('hidden');
            setTimeout(() => {
                warningModal.classList.remove('opacity-0');
                warningContent.classList.remove('scale-95');
            }, 10);
            return;
        }

        pendingQuestId = id;
        document.getElementById('confirm-quest-title').innerText = `Apakah Anda yakin sudah mengerjakan misi:\n"${quest.title}"?`;
        
        const modal = document.getElementById('modal-confirm');
        const modalContent = document.getElementById('modal-confirm-content');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modalContent.classList.remove('scale-95');
        }, 10);
    }
}

function closeConfirmModal() {
    const modal = document.getElementById('modal-confirm');
    const modalContent = document.getElementById('modal-confirm-content');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        pendingQuestId = null;
    }, 300);
}

function closeWarningModal() {
    const modal = document.getElementById('modal-warning');
    const modalContent = document.getElementById('modal-warning-content');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function executeQuestCompletion() {
    if (!pendingQuestId) return;

    const questIndex = playerState.quests.findIndex(q => q.id === pendingQuestId);
    if (questIndex > -1) {
        const quest = playerState.quests[questIndex];
        quest.status = 'DONE';
        playerState.stats.gold += quest.gold;
        playerState.stats.xp += quest.xp;

        checkLevelUp(); 

        saveToStorage();
        renderTimeline();
    }

    closeConfirmModal();
}

let pendingDeleteId = null;
let pendingDeleteType = null; 

function openDeleteModal(id, type) {
    pendingDeleteId = id;
    pendingDeleteType = type;
    
    const modal = document.getElementById('modal-delete-confirm');
    const modalContent = document.getElementById('modal-delete-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeDeleteModal() {
    const modal = document.getElementById('modal-delete-confirm');
    const modalContent = document.getElementById('modal-delete-content');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        pendingDeleteId = null;
        pendingDeleteType = null;
    }, 300);
}

function executeDeleteQuest() {
    if (pendingDeleteId === null) return;
    
    if (pendingDeleteType === 'main') {
        playerState.quests = playerState.quests.filter(q => q.id !== pendingDeleteId);
        renderTimeline();
        showToast("Jadwal misi berhasil dihapus!", "info");
    } else if (pendingDeleteType === 'side') {
        playerState.sideQuests = playerState.sideQuests.filter(q => q.id !== pendingDeleteId);
        renderSideQuests();
        showToast("Tugas opsional dihapus.", "info");
    }
    
    saveToStorage();
    closeDeleteModal();
}

function renderSideQuests() {
    const list = document.getElementById('sq-list');
    list.innerHTML = '';
    playerState.sideQuests.forEach(sq => {
        if(sq.status === 'AVAILABLE') {
            list.innerHTML += `
                <div class="bg-cardbg border border-slate-700 rounded-xl p-4 flex justify-between items-center shadow-sm hover:border-slate-500 transition-colors">
                    <div>
                        <div class="font-bold text-sm text-white">${sq.title}</div>
                        <div class="text-xs text-rpggold mt-1"><i class="ph-fill ph-coin"></i> ${sq.gold} Gold | <i class="ph-fill ph-sparkle"></i> ${sq.xp} XP</div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <button onclick="openDeleteModal(${sq.id}, 'side')" class="text-slate-600 hover:text-red-500 transition-colors" title="Hapus Tugas">
                            <i class="ph-fill ph-trash text-lg"></i>
                        </button>
                        <button onclick="completeSideQuest(${sq.id})" class="w-8 h-8 rounded border-2 border-slate-500 hover:border-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                            <i class="ph-bold ph-check text-slate-500 hover:text-emerald-500 opacity-0 hover:opacity-100 transition-opacity"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    });
    if(list.innerHTML === '') {
        list.innerHTML = `<div class="text-center p-6 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-xl">Semua tugas opsional telah diselesaikan!</div>`;
    }
}

// === Setup klik area luar untuk menutup pop-up otomatis ===
const outsideClickModals = [
    { id: 'modal-add-quest', closeFn: closeAddQuestModal },
    { id: 'modal-quest-detail', closeFn: closeQuestDetail },
    { id: 'modal-warning', closeFn: closeWarningModal }
];

outsideClickModals.forEach(m => {
    const modalEl = document.getElementById(m.id);
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            // Pastikan yang diklik adalah area latar belakang (bukan isi card-nya)
            if (e.target === modalEl) {
                m.closeFn();
            }
        });
    }
});

function completeSideQuest(id) {
    const sq = playerState.sideQuests.find(q => q.id === id);
    if (sq && sq.status === 'AVAILABLE') {
        sq.status = 'DONE';
        playerState.stats.gold += sq.gold;
        playerState.stats.xp += sq.xp;
        showToast(`Tugas Opsional Selesai! +${sq.gold} Gold`, 'success');
        checkLevelUp();
        saveToStorage();
        renderSideQuests();
    }
}

function addSideQuest() {
    const input = document.getElementById('new-sq-title');
    if(!input.value.trim()) return;
    playerState.sideQuests.unshift({
        id: Date.now(), title: input.value.trim(), gold: 5, xp: 5, status: "AVAILABLE"
    });
    input.value = '';
    saveToStorage();
    renderSideQuests();
}

function buyItem(type, price) {
    const caps = { potion: 3, game: 1 }; // Batas maksimal item di tas
    const names = { potion: "Ramuan Pemulih HP", game: "Izin Main Game" };

    // Cek uang dulu (Layer 1)
    if (playerState.stats.gold < price) {
        return showToast("Gold tidak cukup! Selesaikan misi dulu.", 'error');
    }

    // Jika uang cukup, cek kapasitas tas (Layer 2)
    if (playerState.inventory[type] >= caps[type]) {
        return showToast(`Tas penuh! Maksimal ${caps[type]} ${names[type]}.`, 'error');
    }

    // Eksekusi pembelian jika uang cukup dan tas muat
    playerState.stats.gold -= price;
    playerState.inventory[type]++; // Masukkan ke tas
    showToast(`Berhasil dibeli! Cek Tas Ransel.`, 'success');
    saveToStorage();
    renderInventory();
}

function useItem(type) {
    if (playerState.inventory[type] <= 0) return;

    if (type === 'potion') {
        if (playerState.stats.hp >= playerState.stats.maxHp) {
            return showToast("HP masih penuh! Simpan ramuanmu.", 'error');
        }
        playerState.inventory.potion--;
        playerState.stats.hp += 20;
        if (playerState.stats.hp > playerState.stats.maxHp) playerState.stats.hp = playerState.stats.maxHp;
        showToast("Glug glug... HP Pulih 20 poin!", 'success');
        
    } else if (type === 'game') {
        playerState.inventory.game--;
        // Aktifkan Game Mode selama 2 Jam (2 jam * 60 mnt * 60 dtk * 1000 ms)
        playerState.buffs.gameModeUntil = Date.now() + (2 * 60 * 60 * 1000);
        showToast("GAME MODE AKTIF! Kamu kebal hukuman selama 2 Jam.", 'success');
    }

    saveToStorage();
    renderInventory();
    updateUIStats(); // Perbarui UI darah dan label buff
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;

    const inv = playerState.inventory;
    
    // Cek Jika Tas Ransel Kosong Total
    if (inv.potion === 0 && inv.game === 0) {
        list.className = "col-span-full flex items-center justify-center"; // Hapus format grid sementara
        list.innerHTML = `
            <div class="text-center p-8 border-2 border-dashed border-slate-700 rounded-xl w-full max-w-sm mt-4 opacity-70">
                <i class="ph-fill ph-wind text-5xl text-slate-600 mb-2"></i>
                <h3 class="text-slate-300 font-bold text-sm mb-1">Ranselmu Kosong</h3>
                <p class="text-slate-500 text-xs">Belum ada perlengkapan. Segera belanja di Toko Hadiah!</p>
            </div>
        `;
        return;
    }

    // Jika ada isinya, kembalikan format grid
    list.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4";
    let htmlContent = '';

    // Kartu Ramuan (Hanya dirender jika jumlah > 0)
    if (inv.potion > 0) {
        htmlContent += `
        <div class="perspective-1000 h-[190px] group cursor-pointer" onclick="this.querySelector('.flip-inner').classList.toggle('rotate-y-180')">
            <div class="flip-inner relative w-full h-full preserve-3d">
                <div class="absolute w-full h-full backface-hidden bg-cardbg border border-slate-700 hover:border-rpghp/50 shadow-lg transition-colors rounded-xl p-3 md:p-4 flex flex-col items-center justify-between text-center overflow-hidden">
                    <span class="absolute top-2 right-2 text-[9px] md:text-[10px] font-bold bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 z-10">x${inv.potion}/3</span>
                    <i class="ph-fill ph-flask text-4xl md:text-5xl text-rpghp drop-shadow-md z-10"></i>
                    <h3 class="font-bold text-[11px] md:text-sm text-white z-10">Ramuan Pemulih HP</h3>
                    <button onclick="event.stopPropagation(); useItem('potion')" class="w-full bg-rpghp hover:bg-red-500 text-white font-bold py-2 rounded-lg text-[10px] md:text-xs transition-colors z-10">GUNAKAN</button>
                    <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-rpghp/20 rounded-full blur-2xl"></div>
                </div>
                <div class="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 border-2 border-rpghp rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-lg">
                    <h3 class="font-bold text-rpghp text-[10px] md:text-xs mb-1">DETAIL:</h3>
                    <p class="text-[10px] md:text-xs text-slate-300 leading-relaxed font-medium">Buka segelnya dan tenggak sekaligus untuk memulihkan 20 HP seketika.</p>
                    <span class="text-[9px] md:text-[10px] text-slate-500 mt-3 absolute bottom-2">(Ketuk untuk membalik)</span>
                </div>
            </div>
        </div>
        `;
    }

    // Kartu Game Pass (Hanya dirender jika jumlah > 0)
    if (inv.game > 0) {
        htmlContent += `
        <div class="perspective-1000 h-[190px] group cursor-pointer" onclick="this.querySelector('.flip-inner').classList.toggle('rotate-y-180')">
            <div class="flip-inner relative w-full h-full preserve-3d">
                <div class="absolute w-full h-full backface-hidden bg-cardbg border border-slate-700 hover:border-blue-500/50 shadow-lg transition-colors rounded-xl p-3 md:p-4 flex flex-col items-center justify-between text-center overflow-hidden">
                    <span class="absolute top-2 right-2 text-[9px] md:text-[10px] font-bold bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 z-10">x${inv.game}/1</span>
                    <i class="ph-fill ph-game-controller text-4xl md:text-5xl text-blue-500 drop-shadow-md z-10"></i>
                    <h3 class="font-bold text-[11px] md:text-sm text-white z-10">Izin Main Game</h3>
                    <button onclick="event.stopPropagation(); useItem('game')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-[10px] md:text-xs transition-colors z-10">AKTIFKAN</button>
                    <div class="absolute -bottom-10 -right-10 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
                </div>
                <div class="absolute w-full h-full backface-hidden rotate-y-180 bg-slate-800 border-2 border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-lg">
                    <h3 class="font-bold text-blue-400 text-[10px] md:text-xs mb-1">DETAIL:</h3>
                    <p class="text-[10px] md:text-xs text-slate-300 leading-relaxed font-medium">Mengaktifkan perisai khusus (Game Mode). Kebal dari pengurangan HP selama 2 Jam.</p>
                    <span class="text-[9px] md:text-[10px] text-slate-500 mt-3 absolute bottom-2">(Ketuk untuk membalik)</span>
                </div>
            </div>
        </div>
        `;
    }

    list.innerHTML = htmlContent;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let colorClass = "bg-slate-800 border-l-rpgpurple text-white";
    let icon = "ph-info";
    if(type === 'success') { colorClass = "bg-emerald-900 border-l-emerald-400 text-emerald-100"; icon = "ph-check-circle"; }
    if(type === 'error') { colorClass = "bg-red-900 border-l-red-400 text-red-100"; icon = "ph-warning-circle"; }

    toast.className = `toast flex items-center gap-3 border-l-4 p-4 rounded shadow-lg min-w-[250px] ${colorClass}`;
    toast.innerHTML = `<i class="ph-fill ${icon} text-xl"></i> <span class="text-sm font-medium">${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function checkDailyReset() {
    const today = new Date().toLocaleDateString();
    
    // Cek apakah hari sudah berganti (melewati jam 12 malam)
    if (playerState.lastPlayDate !== today) {
        
        // 1. FILTER: Hapus semua misi utama yang BUKAN harian (isDaily == false/undefined)
        playerState.quests = playerState.quests.filter(q => q.isDaily);
        
        // 2. RESET: Kembalikan status misi harian yang tersisa menjadi tersedia
        playerState.quests.forEach(q => q.status = 'AVAILABLE');
        
        // 3. RESET SIDE QUEST: Kembalikan misi sampingan yang sudah selesai
        playerState.sideQuests.forEach(sq => {
            if(sq.status === 'DONE') sq.status = 'AVAILABLE';
        });
        
        // Catat tanggal hari ini agar tidak reset berulang-ulang
        playerState.lastPlayDate = today;
        saveToStorage();
        
        showToast("Hari baru! Misi non-harian telah dibersihkan.", 'info');
        renderTimeline();
        renderSideQuests();
    }
}

// === FUNGSI MESIN WAKTU (SUDAH DIPERBAIKI) ===
function gameLoop() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const currentString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    // Perbarui Teks Jam di Kanan Atas
    const timeDisplay = document.getElementById('current-time-display');
    if (timeDisplay) timeDisplay.innerText = currentString;
    
    // Perbarui Garis Waktu Ungu
    const timeIndicator = document.getElementById('time-indicator');
    if (timeIndicator) {
        const totalMinutes = (h * 60) + m;
        timeIndicator.style.top = `${totalMinutes * 2}px`;
    }
    
    let isUpdated = false;

    // Cek apakah Game Mode sedang aktif
    const isGameMode = playerState.buffs.gameModeUntil && Date.now() < playerState.buffs.gameModeUntil;

    playerState.quests.forEach(quest => {
        if (quest.status === 'AVAILABLE' && currentString >= quest.endTime) {
            quest.status = 'FAILED';
            if (quest.isWajib) {
                // Jika tidak kebal, kurangi HP
                if (!isGameMode) {
                    playerState.stats.hp -= 10;
                    
                    if (playerState.stats.hp <= 0) {
                        playerState.stats.hp = 0; 
                        triggerGameOver();
                    }
                }
                // Jika isGameMode = true, blokir pengurangan HP (Kebal)
            }
            isUpdated = true;
        }
    });

    if (isUpdated) {
        saveToStorage();
        renderTimeline();
    }
}

function checkGameOver() {
    const modal = document.getElementById('modal-game-over');
    if (playerState.stats.hp <= 0 && modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    }
}

function checkFirstTime() {
    if (!localStorage.getItem('myquest_first_time')) {
        document.getElementById('modal-first-time').classList.remove('hidden');
    }
}

function closeFirstTimeModal() {
    localStorage.setItem('myquest_first_time', 'true');
    document.getElementById('modal-first-time').classList.add('hidden');
}

function exportData() {
    const dataStr = JSON.stringify(playerState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myquest_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast("Backup berhasil diunduh!", 'success');
}

function importData(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.stats && imported.quests) {
                playerState = imported;
                saveToStorage();
                showToast("Data berhasil dipulihkan!", 'success');
                setTimeout(() => location.reload(), 1000);
            } else { throw new Error("Invalid structure"); }
        } catch (err) {
            showToast("Gagal! File rusak atau tidak valid.", 'error');
        }
    };
    reader.readAsText(file);
}

function openAddQuestModal() {
    const modal = document.getElementById('modal-add-quest');
    const modalContent = document.getElementById('modal-add-quest-content');
    
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    document.getElementById('quest-start').value = `${h}:${m}`;
    
    now.setHours(now.getHours() + 1);
    document.getElementById('quest-end').value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

function closeAddQuestModal() {
    const modal = document.getElementById('modal-add-quest');
    const modalContent = document.getElementById('modal-add-quest-content');
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('form-add-quest').reset();
    }, 300);
}

function submitNewQuest(event) {
    event.preventDefault();
    
    const title = document.getElementById('quest-title').value.trim();
    const desc = document.getElementById('quest-desc').value.trim();
    const startTime = document.getElementById('quest-start').value;
    const endTime = document.getElementById('quest-end').value;
    const isWajib = document.getElementById('quest-wajib').checked;
    const isDaily = document.getElementById('quest-daily').checked; 
    const gold = parseInt(document.getElementById('quest-gold').value) || 0;
    const xp = parseInt(document.getElementById('quest-xp').value) || 0;

    if (startTime >= endTime) {
        showToast("Jam selesai harus lebih besar dari jam mulai!", "error");
        return;
    }

    const newQuest = {
        id: Date.now(),
        title: title,
        description: desc,
        startTime: startTime,
        endTime: endTime,
        isWajib: isWajib,
        isDaily: isDaily,
        gold: gold,
        xp: xp,
        status: "AVAILABLE"
    };

    playerState.quests.push(newQuest);
    playerState.quests.sort((a, b) => a.startTime.localeCompare(b.startTime));

    saveToStorage();
    renderTimeline();
    
    showToast("Misi berhasil ditambahkan ke jadwal!", "success");
    closeAddQuestModal();
}

// ==========================================
// SISTEM LEVEL UP & GAME OVER
// ==========================================

function checkLevelUp() {
    let maxXP = playerState.stats.lvl * 100; 
    
    if (playerState.stats.xp >= maxXP) {
        playerState.stats.xp -= maxXP; 
        playerState.stats.lvl += 1;
        playerState.stats.hp = playerState.stats.maxHp; 
        
        const goldReward = playerState.stats.lvl * 50;
        playerState.stats.gold += goldReward;
        
        document.getElementById('levelup-new-level').innerText = playerState.stats.lvl;
        document.getElementById('levelup-gold-reward').innerText = goldReward;
        
        const modal = document.getElementById('modal-levelup');
        const content = document.getElementById('modal-levelup-content');
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-90'); }, 10);
        
        saveToStorage(); 
        
        if (playerState.stats.xp >= playerState.stats.lvl * 100) {
            setTimeout(checkLevelUp, 1000);
        }
    }
}

function triggerGameOver() {
    let goldLost = 0;
    let penaltyDesc = "";

    // Kalkulasi 50% dari Gold saat ini
    let halfGold = Math.floor(playerState.stats.gold * 0.5);
    
    // LOGIKA DENDA DINAMIS
    if (playerState.stats.gold > 0 && halfGold >= 50) {
        // Jika sedang kaya: Denda 50%
        goldLost = halfGold;
        penaltyDesc = "*Denda 50% dari total tabungan Gold saat ini.";
    } else {
        // Jika miskin / minus: Denda mutlak 50 Gold
        goldLost = 50;
        if (playerState.stats.gold <= 0) {
            penaltyDesc = "*Denda mutlak 50 Gold (Sistem Hutang) karena tabungan kosong.";
        } else {
            penaltyDesc = "*Denda minimum 50 Gold (Tabungan tidak mencapai batas potongan 50%).";
        }
    }

    playerState.stats.gold -= goldLost;
    playerState.stats.hp = playerState.stats.maxHp; 
    
    // Update Teks di UI Modal
    document.getElementById('gameover-gold-lost').innerText = goldLost;
    
    const descElement = document.getElementById('gameover-penalty-desc');
    if (descElement) descElement.innerText = penaltyDesc;
    
    // Tampilkan Modal
    const modal = document.getElementById('modal-gameover');
    const content = document.getElementById('modal-gameover-content');
    modal.classList.remove('hidden');
    setTimeout(() => { 
        modal.classList.remove('opacity-0'); 
        content.classList.remove('scale-90'); 
    }, 10);
    
    saveToStorage();
}

function closeLevelUp() {
    const modal = document.getElementById('modal-levelup');
    const content = document.getElementById('modal-levelup-content');
    modal.classList.add('opacity-0'); content.classList.add('scale-90');
    setTimeout(() => { modal.classList.add('hidden'); }, 500);
}

function closeGameOver() {
    const modal = document.getElementById('modal-gameover');
    const content = document.getElementById('modal-gameover-content');
    modal.classList.add('opacity-0'); content.classList.add('scale-90');
    setTimeout(() => { modal.classList.add('hidden'); }, 500);
}

// === LOGIKA KEMBALI KE DETAIL SAAT BATAL ===
function cancelConfirmModal() {
    const idToReopen = pendingQuestId; // Simpan ID sebelum dihapus oleh fungsi close
    closeConfirmModal();
    if (idToReopen) {
        setTimeout(() => {
            openQuestDetail(idToReopen); // Buka kembali setelah animasi tutup selesai
        }, 300);
    }
}

function cancelDeleteModal() {
    const idToReopen = pendingDeleteId;
    const type = pendingDeleteType;
    closeDeleteModal();
    
    // Hanya buka kembali pop-up detail jika yang dibatalkan adalah misi utama
    if (idToReopen && type === 'main') {
        setTimeout(() => {
            openQuestDetail(idToReopen);
        }, 300);
    }
}

// INIT
window.addEventListener('load', () => {
    checkFirstTime();
    checkDailyReset();
    updateUIStats();
    renderTimeline();
    renderSideQuests();
    renderInventory();
    
    gameLoop();
    setInterval(gameLoop, 1000); 
    
    const now = new Date();
    const startScroll = Math.max(0, (now.getHours() * 120) - 100);
    document.getElementById('scroll-container').scrollTo({ top: startScroll, behavior: 'smooth' });
});