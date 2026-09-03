// js/main.js - Lógica Principal do Sistema PLAY IPAM

const SUPABASE_URL = "https://stkjuqcjlqgtrwmktixt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0a2p1cWNqbHFndHJ3bWt0aXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2ODQxMTEsImV4cCI6MjEwMzI2MDExMX0.qI8nQGOA-QQKCMeKb5yLHYgzQD7nuul18L5MtNkx3s4";

const sbClient = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

let ipDatabase = [];
let selectedSubnet = "ALL";
window.pingActive = false;
let currentDrawerIp = null;

document.addEventListener('DOMContentLoaded', async () => {
    const cached = localStorage.getItem("PLAY_IPAM_PERSISTED");
    if (cached) {
        try { ipDatabase = JSON.parse(cached); } catch (e) { }
    }
    
    window.renderSubnetPills();
    window.renderCatalog();
    window.updateMetrics();

    await window.syncSupabase(false);

    if (sbClient) {
        try {
            sbClient.channel('realtime_sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'radio_hosts' }, () => {
                    window.syncSupabase(false);
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'host_comments' }, () => {
                    if (currentDrawerIp) window.loadCommentsForHost(currentDrawerIp);
                })
                .subscribe();
        } catch (e) { console.warn("Erro no Realtime", e); }
    }
});

// ==========================
// FUNÇÕES DE REDE E UI
// ==========================

window.openDeviceWeb = function (ip, marcaOuNome) {
    const m = (marcaOuNome || '').toLowerCase();
    let targetUrl = '';
    if (m.includes('mikrotik') || m.includes('routeros') || m.includes('swt') || m.startsWith('sw')) {
        targetUrl = `http://${ip}`;
    } else {
        targetUrl = `https://${ip}:8074`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
};

window.syncSupabase = async function (showFeedback = false) {
    if (!sbClient) return;
    try {
        if (showFeedback) window.showToast('Sincronizando com nuvem...');
        const { data, error } = await sbClient.from('radio_hosts').select('*').order('ip', { ascending: true }).limit(5000);

        if (!error && Array.isArray(data) && data.length > 0) {
            ipDatabase = data.map(item => ({
                ip: item.ip,
                name: item.name || '',
                user: item.user_name || 'admin',
                pass: item.password || 'play8074',
                marca: item.marca || 'Ubiquiti',
                community: item.community || 'k1239q!$f',
                modelo: item.modelo || '',
                pop: item.pop || '',
                role: item.role || 'HOST',
                freq: item.freq || '',
                ssid: item.ssid || '',
                subnet: item.subnet || ''
            }));

            localStorage.setItem("PLAY_IPAM_PERSISTED", JSON.stringify(ipDatabase));
            window.renderSubnetPills();
            window.renderCatalog();
            window.updateMetrics();
            if (showFeedback) window.showToast(`${data.length} hosts sincronizados.`);
        }
    } catch (err) {
        console.warn("Offline. Mantendo cache local.", err);
    }
};

window.renderSubnetPills = function () {
    const dataSubnets = [...new Set(ipDatabase.map(item => item.subnet))].filter(Boolean).sort();
    const container = document.getElementById('subnet-pills');
    if (!container) return;

    container.innerHTML = ["ALL", ...dataSubnets].map(s => `
        <button onclick="window.setSubnetFilter('${s}')" class="px-2 py-1.5 rounded text-[10px] font-mono transition border ${selectedSubnet === s ? 'bg-status-matrix text-black border-status-matrix font-bold shadow-[0_0_10px_rgba(5,255,145,0.4)]' : 'bg-black/20 text-slate-400 hover:text-slate-200 border-noc-border hover:border-slate-500'}">
            ${s === 'ALL' ? 'RESET FILTRO' : s}
        </button>
    `).join('');
};

window.setSubnetFilter = function (subnet) {
    selectedSubnet = subnet;
    window.renderSubnetPills();
    window.renderCatalog();
};

window.renderCatalog = function () {
    const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const filtered = ipDatabase.filter(item => {
        const matchesSearch = !searchVal || item.ip.toLowerCase().includes(searchVal) || item.name.toLowerCase().includes(searchVal) || (item.pop && item.pop.toLowerCase().includes(searchVal)) || (item.ssid && item.ssid.toLowerCase().includes(searchVal));
        const matchesSubnet = selectedSubnet === 'ALL' || item.subnet === selectedSubnet;
        return matchesSearch && matchesSubnet;
    });

    const showingCount = document.getElementById('showing-count');
    const totalCount = document.getElementById('total-count');
    if (showingCount) showingCount.innerText = filtered.length;
    if (totalCount) totalCount.innerText = ipDatabase.length;

    const tableBody = document.getElementById('ip-table-body');
    const emptyState = document.getElementById('empty-state');

    if (!tableBody) return;

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
        return;
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
    }

    tableBody.innerHTML = filtered.map((item, index) => {
        const roleBadge = window.getRoleBadge(item.role, item.name);
        const marcaDesc = item.marca || item.role || item.name;
        
        return `
            <tr class="cursor-pointer group" onclick="window.openDetailsModal('${item.ip}')">
                <td class="text-center text-[10px] text-slate-600">${index + 1}</td>
                <td class="font-bold text-slate-300 group-hover:text-status-matrix transition">
                    <div class="flex items-center space-x-1.5">
                        <button onclick="event.stopPropagation(); window.copyToClipboard('${item.ip}')" class="text-slate-500 hover:text-status-matrix transition" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                        <span>${item.ip}</span>
                    </div>
                </td>
                <td class="font-sans text-slate-200">
                    <div class="flex items-center space-x-2">
                        <span class="truncate max-w-[140px]" title="${item.name}">${item.name}</span>
                        ${roleBadge}
                    </div>
                </td>
                <td class="text-[10px] text-slate-400">${item.subnet}</td>
                <td class="text-xs font-sans text-slate-300">${item.pop || '-'}</td>
                <td class="text-[10px] text-slate-400 truncate max-w-[100px]">${item.ssid ? `<span class="text-status-matrix/70">${item.ssid}</span>` : '-'}</td>
                <td class="text-center">
                    <div class="flex items-center justify-end space-x-1.5">
                        <button onclick="event.stopPropagation(); window.traceL2Link('${item.ip}')" class="px-2 py-1 rounded text-[10px] font-mono transition border border-emerald-500/40 text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 hover:text-emerald-300 flex items-center space-x-1" title="Traçar Enlace L2">
                            <i class="fa-solid fa-diagram-project"></i> <span>Enlace</span>
                        </button>
                        <button onclick="event.stopPropagation(); window.openDeviceWeb('${item.ip}', '${marcaDesc}')" class="px-2 py-1 rounded text-[10px] font-mono transition border border-cyan-500/40 text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 hover:text-cyan-200 flex items-center space-x-1" title="Acesso Web">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> <span>Acessar</span>
                        </button>
                        <button onclick="event.stopPropagation(); window.selectForPing('${item.ip}')" class="px-2 py-1 rounded text-[10px] font-mono transition border border-slate-700 text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white flex items-center space-x-1" title="Ping Probe">
                            <i class="fa-solid fa-satellite-dish"></i> <span>Ping</span>
                        </button>
                        <button onclick="event.stopPropagation(); window.openCommentsDrawer('${item.ip}', '${item.name}')" class="px-2 py-1 rounded text-[10px] font-mono transition border border-noc-border text-slate-400 hover:text-white hover:border-slate-500" title="Ocorrências">
                            <i class="fa-regular fa-comment-dots"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.getRoleBadge = function (role, name) {
    const r = (role || '').toUpperCase(); const n = (name || '').toUpperCase();
    if (r.includes('SW') || n.startsWith('SW')) return `<span class="status-badge role-sw">SW</span>`;
    if (r.includes('AP') || n.startsWith('AP')) return `<span class="status-badge role-ap">AP</span>`;
    if (r.includes('ST') || n.startsWith('ST')) return `<span class="status-badge role-st">ST</span>`;
    return `<span class="status-badge role-term">TR</span>`;
};

window.traceL2Link = function (targetIp) {
    const target = ipDatabase.find(h => h.ip === targetIp);
    if (!target) return;
    
    document.getElementById('trace-badge').innerText = `${target.ip}`;
    const container = document.getElementById('traceOutputContainer');
    const subnetHosts = ipDatabase.filter(h => h.subnet === target.subnet);

    const swt = subnetHosts.find(h => h.role === 'SWT' || (h.name && h.name.toUpperCase().startsWith('SW'))) || { name: `SWT ${target.pop || 'CORE'}`, ip: target.subnet.replace('.0/24', '.2'), marca: 'MIKROTIK' };
    const ap = subnetHosts.find(h => (h.role === 'AP' || (h.name && h.name.toUpperCase().startsWith('AP'))) && (h.ssid === target.ssid || !target.ssid)) || { name: `AP ${target.pop || 'MASTER'}`, ip: target.subnet.replace('.0/24', '.3'), ssid: target.ssid || 'PTP', freq: target.freq || '5.8G', marca: 'Ubiquiti' };

    let st = null;
    if (target.role === 'PLAY' || target.name.toUpperCase().includes('PLAY') || target.role === 'ST') {
        st = subnetHosts.find(h => (h.role === 'ST' || (h.name && h.name.toUpperCase().startsWith('ST'))) && h.ssid && h.ssid === target.ssid && h.ip !== target.ip);
    }

    const hops = [
        { step: 1, type: 'sw', name: swt.name, ip: swt.ip, marca: swt.marca || 'MIKROTIK', icon: 'fa-server' },
        { step: 2, type: 'ap', name: ap.name, ip: ap.ip, marca: ap.marca || 'Ubiquiti', icon: 'fa-satellite-dish' }
    ];

    if (st && st.ip !== target.ip) { hops.push({ step: 3, type: 'st', name: st.name, ip: st.ip, marca: st.marca || 'Ubiquiti', icon: 'fa-tower-broadcast' }); }
    hops.push({ step: hops.length + 1, type: 'term', name: target.name, ip: target.ip, marca: target.marca || 'Ubiquiti', icon: 'fa-microchip' });

    container.innerHTML = `<div class="relative pl-8 py-2">
        <div class="absolute left-3.5 top-6 bottom-6 w-[2px] border-l-2 border-dashed border-status-matrix/40"></div>
        ${hops.map((h, i) => {
            const isLast = i === hops.length - 1;
            const colorClass = isLast ? 'text-status-matrix' : (h.type === 'sw' ? 'text-status-purple' : (h.type === 'ap' ? 'text-status-online' : 'text-slate-400'));
            
            return `
            <div class="relative flex items-center justify-between group p-3 hover:bg-black/20 rounded-lg transition-colors mb-1">
                <div class="absolute -left-[1.5rem] w-3 h-3 rounded-full bg-noc-bg border-2 border-status-matrix group-hover:bg-status-matrix z-10 transition shadow-[0_0_8px_rgba(5,255,145,0.8)]"></div>
                
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded bg-black/30 border border-noc-border flex items-center justify-center text-xs ${colorClass}">
                        <i class="fa-solid ${h.icon}"></i>
                    </div>
                    <div>
                        <div class="text-xs font-semibold text-slate-200 group-hover:text-status-matrix transition">${h.name}</div>
                        <div class="text-[9px] font-mono text-slate-500 uppercase mt-0.5">${h.type.toUpperCase()} · ${h.marca}</div>
                    </div>
                </div>
                
                <div class="flex items-center space-x-2">
                    <span class="font-mono text-[10px] ${colorClass} font-bold">${h.ip}</span>
                    <button onclick="window.openDeviceWeb('${h.ip}', '${h.marca}')" class="text-slate-500 hover:text-status-matrix p-1.5 transition" title="Acessar">
                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </button>
                </div>
            </div>`;
        }).join('')}
    </div>`;
};

window.selectForPing = function (ip) {
    const input = document.getElementById('ping-input');
    if (input) {
        input.value = ip;
        window.runPingTest();
    }
};

function testHostLatency(ip, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        const img = new Image();
        let settled = false;

        const cleanup = () => { img.onload = null; img.onerror = null; img.src = ''; };
        const timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve({ online: false, ms: timeoutMs }); } }, timeoutMs);

        img.onload = () => { if (!settled) { settled = true; clearTimeout(timer); const ms = Math.max(1, Math.round(performance.now() - startTime)); cleanup(); resolve({ online: true, ms }); } };
        img.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); const ms = Math.max(1, Math.round(performance.now() - startTime)); cleanup(); const isResponsive = ms < (timeoutMs - 100); resolve({ online: isResponsive, ms }); } };

        img.src = `http://${ip}/favicon.ico?_probe=${Date.now()}`;
    });
}

window.runPingTest = async function () {
    const selectedIp = document.getElementById('ping-input')?.value.trim();
    const pingType = document.getElementById('ping-type')?.value;
    const output = document.getElementById('ping-output');

    if (!selectedIp || !output) return;

    window.pingActive = true;
    document.getElementById('btn-ping')?.classList.add('hidden');
    document.getElementById('btn-stop-ping')?.classList.remove('hidden');

    output.innerHTML = `<div><span class="text-status-matrix">> MATRIX_PROBE</span> <span class="text-slate-300">${selectedIp}</span></div>`;

    let packetsSent = 0;
    const maxPackets = pingType === 'continuous' ? Infinity : parseInt(pingType);

    while (window.pingActive && packetsSent < maxPackets) {
        packetsSent++;
        const res = await testHostLatency(selectedIp, 1400);

        if (res.online) {
            output.innerHTML += `<div>Reply from <span class="text-slate-300">${selectedIp}</span>: time=<span class="text-status-matrix">${res.ms}ms</span></div>`;
        } else {
            output.innerHTML += `<div class="text-status-danger">Request timed out for ${selectedIp}</div>`;
        }

        output.scrollTop = output.scrollHeight;
        if (window.pingActive && packetsSent < maxPackets) {
            await new Promise(r => setTimeout(r, 900));
        }
    }

    window.stopPingTest();
};

window.stopPingTest = function () {
    window.pingActive = false;
    const output = document.getElementById('ping-output');
    if (output && !output.innerHTML.includes('EOF')) {
        output.innerHTML += `<div class="text-slate-500 mt-1 italic">> EOF.</div>`;
        output.scrollTop = output.scrollHeight;
    }
    document.getElementById('btn-ping')?.classList.remove('hidden');
    document.getElementById('btn-stop-ping')?.classList.add('hidden');
};

// ==========================
// GAVETAS E MODAIS
// ==========================

window.openCommentsDrawer = function (ip, name) {
    currentDrawerIp = ip;
    document.getElementById('drawer-host-title').innerText = name || 'EQUIPAMENTO';
    document.getElementById('drawer-host-ip').innerText = ip;
    document.getElementById('drawer-comments').classList.remove('hidden');
    window.loadCommentsForHost(ip);
};

window.closeCommentsDrawer = function () {
    document.getElementById('drawer-comments').classList.add('hidden');
    currentDrawerIp = null;
};

window.loadCommentsForHost = async function (ip) {
    const list = document.getElementById('comments-list');
    list.innerHTML = `<div class="flex justify-center py-4"><div class="noc-loader"></div></div>`;
    if (!sbClient) return;

    try {
        const { data, error } = await sbClient.from('host_comments').select('*').eq('ip', ip).order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
            list.innerHTML = data.map(c => `
                <div class="bg-black/20 border border-noc-border border-l-2 border-l-status-matrix p-2.5 rounded-r">
                    <div class="flex items-center justify-between text-[10px]">
                        <span class="font-semibold text-status-matrix">${c.author || 'NOC'}</span>
                        <span class="text-slate-500 font-mono">${new Date(c.created_at).toLocaleDateString()} ${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-1">${c.comment}</p>
                </div>
            `).join('');
        } else {
            list.innerHTML = `<p class="text-slate-500 italic text-xs text-center py-4">> NO LOGS FOUND.</p>`;
        }
    } catch (e) {
        list.innerHTML = `<p class="text-status-danger text-xs">Erro de conexão DB.</p>`;
    }
};

window.saveComment = async function () {
    if (!currentDrawerIp || !sbClient) return;
    const author = document.getElementById('comment-author').value.trim() || 'NOC';
    const comment = document.getElementById('comment-text').value.trim();

    if (!comment) return;

    try {
        const { error } = await sbClient.from('host_comments').insert([{ ip: currentDrawerIp, author, comment }]);
        if (!error) {
            document.getElementById('comment-text').value = '';
            window.loadCommentsForHost(currentDrawerIp);
        }
    } catch (e) {}
};

// ==========================
// OUTROS E UTILITÁRIOS
// ==========================

window.handleFileSelect = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    window.showToast('Compilando planilha...');
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const imported = [];

            workbook.SheetNames.forEach(sheetName => {
                const jsonRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
                jsonRows.forEach(row => {
                    if (!row || !Array.isArray(row) || row.length < 2) return;

                    let ipFound = null;
                    let ipColIdx = -1;
                    for (let i = 0; i < row.length; i++) {
                        const val = String(row[i] || '').trim();
                        const match = val.match(/\b(?:172\.(?:1[6-9]|2[0-9]|3[01])|10\.\d{1,3}|192\.168|38\.190)\.\d{1,3}\.\d{1,3}\b/);
                        if (match) {
                            ipFound = match[0];
                            ipColIdx = i;
                            break;
                        }
                    }

                    if (ipFound) {
                        const octs = ipFound.split('.');
                        const name = ipColIdx > 0 ? String(row[0] || '').trim() : `HOST_${octs[3]}`;
                        imported.push({
                            ip: ipFound,
                            name: name || `HOST_${octs[3]}`,
                            user_name: String(row[2] || 'admin').trim(),
                            password: String(row[3] || 'play8074').trim(),
                            marca: String(row[4] || 'Ubiquiti').trim(),
                            community: String(row[5] || 'k1239q!$f').trim(),
                            modelo: String(row[6] || '').trim(),
                            pop: String(row[7] || sheetName).trim(),
                            role: String(row[8] || 'HOST').trim(),
                            freq: String(row[9] || '').trim(),
                            ssid: String(row[11] || row[12] || '').trim(),
                            subnet: `${octs[0]}.${octs[1]}.${octs[2]}.0/24`
                        });
                    }
                });
            });

            if (imported.length > 0) {
                event.target.value = '';
                if (sbClient) {
                    const batchSize = 40;
                    for (let i = 0; i < imported.length; i += batchSize) {
                        const chunk = imported.slice(i, i + batchSize);
                        await sbClient.from('radio_hosts').upsert(chunk, { onConflict: 'ip' });
                    }
                    await window.syncSupabase(false);
                    window.showToast(`${imported.length} hosts commitados DB.`);
                }
            }
        } catch (err) {
            window.showToast('Erro ao ler XLSX/CSV', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
};

window.openDetailsModal = function (ip) {
    const item = ipDatabase.find(h => h.ip === ip);
    if (!item) return;
    document.getElementById('details-title').innerText = item.name;
    document.getElementById('details-ip-subtitle').innerText = item.ip;
    document.getElementById('det-user').innerText = item.user || '-';
    document.getElementById('det-pass').innerText = item.pass || '-';
    document.getElementById('det-marca').innerText = item.marca || '-';
    document.getElementById('det-modelo').innerText = item.modelo || '-';
    document.getElementById('det-community').innerText = item.community || '-';
    document.getElementById('modal-details').classList.remove('hidden');
};

window.closeModal = function (modalId) { document.getElementById(modalId).classList.add('hidden'); };
window.applyFilters = function () { window.renderCatalog(); };
window.resetFilters = function () {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    selectedSubnet = 'ALL';
    window.renderSubnetPills();
    window.renderCatalog();
};

window.updateMetrics = function () {
    const sTotal = document.getElementById('stat-total');
    const sOnline = document.getElementById('stat-online');
    const sPops = document.getElementById('stat-pops');
    const sSubnets = document.getElementById('stat-subnets');
    
    if(sTotal) sTotal.innerText = ipDatabase.length;
    if(sOnline) sOnline.innerText = ipDatabase.length;
    if(sPops) sPops.innerText = new Set(ipDatabase.map(i => i.pop)).size;
    if(sSubnets) sSubnets.innerText = new Set(ipDatabase.map(i => i.subnet)).size;
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text);
    window.showToast(`Copiado: ${text}`);
};

window.exportCSV = function () {
    const headers = ['IP', 'Nome', 'Subrede', 'POP', 'Role', 'SSID', 'Frequencia', 'Modelo', 'Marca', 'Comunidade'];
    const rows = ipDatabase.map(i => [i.ip, `"${i.name}"`, i.subnet, `"${i.pop || ''}"`, `"${i.role || ''}"`, `"${i.ssid || ''}"`, `"${i.freq || ''}"`, `"${i.modelo || ''}"`, `"${i.marca || ''}"`, `"${i.community || ''}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `export_play_ipam_${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); link.remove();
};

window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const isError = type === 'error';
    
    toast.className = `bg-black/80 backdrop-blur-md border border-noc-border ${isError ? 'border-l-status-danger' : 'border-l-status-matrix'} border-l-2 px-3 py-2 rounded shadow-[0_0_15px_rgba(5,255,145,0.2)] text-[10px] font-mono text-slate-200 flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0`;
    toast.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation text-status-danger' : 'fa-check text-status-matrix'}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 50);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => toast.remove(), 300); }, 3000);
};
