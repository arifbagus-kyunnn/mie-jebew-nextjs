"use client";
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
    // State Login
    const [pin, setPin] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // State Data
    const [view, setView] = useState('overview');
    const [pesananData, setPesananData] = useState([]);
    const [menuData, setMenuData] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    // State Filter Laporan
    const [filterBulan, setFilterBulan] = useState('semua');
    const [filterTahun, setFilterTahun] = useState('semua');

    // State Modal Form Menu
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [formMenu, setFormMenu] = useState({ nama: '', deskripsi: '', harga: '', stok: '', gambar: '' });
    const [isSaving, setIsSaving] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const formatWA = (nomor) => {
        if (!nomor) return '';
        let no = nomor.toString().replace(/\D/g, '');
        if (no.startsWith('0')) return '62' + no.substring(1);
        return no;
    };

    // === 1. FUNGSI LOGIN & FETCH ===
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsVerifying(true);
        setLoginError('');
        try {
            const res = await fetch(`/api/gas?action=loginAdmin&pin=${pin}`);
            const data = await res.json();
            if (data.result === 'success') {
                setIsLoggedIn(true);
                fetchData();
            } else {
                setLoginError('PIN SALAH!');
            }
        } catch (err) {
            setLoginError('Koneksi Gagal!');
        }
        setIsVerifying(false);
    };

    const fetchData = async () => {
        setLoadingData(true);
        try {
            const [resPesanan, resMenu] = await Promise.all([
                fetch(`/api/gas?action=getPesanan&pin=${pin}`).then(r => r.json()),
                fetch('/api/gas?action=getMenu').then(r => r.json())
            ]);
            
            if (resPesanan.result === 'success') setPesananData(resPesanan.data.reverse());
            if (resMenu.result === 'success') setMenuData(resMenu.data);
        } catch (err) {
            console.error("Gagal memuat data", err);
        }
        setLoadingData(false);
    };

    // === 2. FUNGSI CRUD MENU ===
    const formatImg = (url) => {
        if (!url) return "";
        if (url.includes("drive.google.com/file/d/")) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
        }
        return url.trim();
    };

    const simpanMenu = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const finalImgUrl = formatImg(formMenu.gambar);
        try {
            await fetch('/api/gas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: editId ? 'editMenu' : 'tambahMenu', id: editId, ...formMenu, gambar: finalImgUrl, pin })
            });
            setShowModal(false);
            fetchData();
        } catch (err) { alert("Gagal menyimpan menu!"); }
        setIsSaving(false);
    };

    const hapusMenu = async (id) => {
        if (!confirm("Yakin hapus permanen?")) return;
        try {
            await fetch('/api/gas', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deleteMenu', id, pin })
            });
            fetchData();
        } catch (err) { alert("Gagal menghapus!"); }
    };

    const openEditModal = (menu) => {
        setEditId(menu.ID); setFormMenu({ nama: menu.Nama, deskripsi: menu.Deskripsi, harga: menu.Harga, stok: menu.Stok, gambar: menu.Gambar || '' }); setShowModal(true);
    };
    const openAddModal = () => {
        setEditId(null); setFormMenu({ nama: '', deskripsi: '', harga: '', stok: '', gambar: '' }); setShowModal(true);
    };

    // === 3. KALKULASI DASHBOARD UMUM ===
    const totalPendapatanUmum = pesananData.reduce((sum, p) => sum + (parseInt(p.TotalHarga) || 0), 0);
    const groupedByDateAll = pesananData.reduce((acc, row) => {
        const dateObj = new Date(row.Timestamp);
        const tglKey = isNaN(dateObj) ? "Lainnya" : dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const jam = isNaN(dateObj) ? row.Timestamp : `${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
        if (!acc[tglKey]) acc[tglKey] = { pesanan: [], subtotal: 0, count: 0 };
        acc[tglKey].pesanan.push({ ...row, jam });
        acc[tglKey].subtotal += (parseInt(row.TotalHarga) || 0); acc[tglKey].count += 1; return acc;
    }, {});

    // === 4. LOGIKA FILTER LAPORAN & CETAK PDF ===
    const availableYears = [...new Set(pesananData.map(p => {
        const d = new Date(p.Timestamp); return isNaN(d) ? null : d.getFullYear();
    }).filter(Boolean))].sort((a, b) => b - a);

    const pesananLaporanFiltered = pesananData.filter(p => {
        const d = new Date(p.Timestamp);
        if (isNaN(d)) return true;
        const matchBulan = filterBulan === 'semua' || (d.getMonth() + 1).toString() === filterBulan;
        const matchTahun = filterTahun === 'semua' || d.getFullYear().toString() === filterTahun;
        return matchBulan && matchTahun;
    });

    const laporanTotalOmset = pesananLaporanFiltered.reduce((sum, p) => sum + (parseInt(p.TotalHarga) || 0), 0);
    
    const laporanGroupedHarian = pesananLaporanFiltered.reduce((acc, row) => {
        const dateObj = new Date(row.Timestamp);
        const tglKey = isNaN(dateObj) ? "Lainnya" : dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!acc[tglKey]) acc[tglKey] = { subtotal: 0, count: 0 };
        acc[tglKey].subtotal += (parseInt(row.TotalHarga) || 0); acc[tglKey].count += 1; return acc;
    }, {});

    // Cetak PDF Dinamis Berdasarkan Filter
    const cetakPDF = () => {
        if (pesananLaporanFiltered.length === 0) { alert("Data kosong, tidak ada yang bisa dicetak."); return; }

        // Kalkulasi Menu Terlaris di periode filter
        let menuCount = {};
        pesananLaporanFiltered.forEach(row => {
            if (row.DetailPesanan) {
                let items = row.DetailPesanan.split(",");
                items.forEach(item => {
                    let parts = item.trim().split("x ");
                    if (parts.length === 2) {
                        let qty = parseInt(parts[0]); let name = parts[1];
                        menuCount[name] = (menuCount[name] || 0) + qty;
                    }
                });
            }
        });
        
        let bestMenu = "-"; let maxQty = 0;
        for (const [name, qty] of Object.entries(menuCount)) {
            if (qty > maxQty) { maxQty = qty; bestMenu = name; }
        }

        let tbodyHtml = "";
        for (const [tgl, stat] of Object.entries(laporanGroupedHarian)) {
            tbodyHtml += `<tr><td>${tgl}</td><td>${stat.count}</td><td class="text-right">${stat.subtotal.toLocaleString('id-ID')}</td></tr>`;
        }

        const periodeBulan = filterBulan !== 'semua' ? `Bulan ${filterBulan}` : 'Semua Bulan';
        const periodeTahun = filterTahun !== 'semua' ? filterTahun : 'Semua Tahun';
        const printDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const printHTML = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>Laporan Penjualan - Mie Jebew</title>
            <style>
                @page { size: 210mm 297mm; margin: 0; }
                html, body { margin: 0; padding: 0; background-color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111111; }
                .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 18mm 12mm 18mm; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
                .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #111111; padding-bottom: 12px; margin-bottom: 24px; }
                .brand-title { font-size: 24pt; font-weight: 900; margin: 0; text-transform: uppercase; }
                .brand-title span { color: #FF2A2A; }
                .report-meta { text-align: right; font-size: 10pt; color: #555555; }
                .report-meta strong { color: #111111; display: block; font-size: 12pt; margin-bottom: 4px; text-transform: uppercase; }
                .summary-grid { display: flex; gap: 16px; margin-bottom: 32px; }
                .summary-card { flex: 1; border: 2px solid #111111; padding: 16px; background-color: #FAFAFA; }
                .summary-label { font-size: 9.5pt; font-weight: bold; text-transform: uppercase; color: #666; margin-bottom: 8px; }
                .summary-value { font-size: 18pt; font-weight: 900; color: #111111; margin: 0; }
                .highlight { color: #FF2A2A; }
                .section-title { font-size: 14pt; font-weight: bold; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 16px; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; font-size: 10pt; }
                thead th { background-color: #111111; color: #ffffff; font-weight: bold; text-align: left; padding: 10px 12px; text-transform: uppercase; font-size: 9pt; }
                tbody td { border-bottom: 1px solid #E5E7EB; padding: 10px 12px; }
                tbody tr:nth-child(even) { background-color: #F9FAFB; }
                .text-right { text-align: right; } .font-bold { font-weight: bold; }
                .signature-block { margin-top: 48px; display: flex; justify-content: flex-end; }
                .signature-box { text-align: center; width: 200px; }
                .signature-line { border-top: 1px solid #111; margin-top: 60px; padding-top: 8px; font-weight: bold; font-size: 10pt; text-transform: uppercase; }
                .signature-role { font-size: 9pt; color: #666; }
                .page-footer { flex-shrink: 0; margin-top: auto; padding-top: 4mm; display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748b; }
            </style>
        </head>
        <body onload="setTimeout(function(){ window.print(); window.close(); }, 500);">
            <div class="page">
                <div>
                    <header class="header">
                        <h1 class="brand-title">MIE <span>JEBEW.</span></h1>
                        <div class="report-meta">
                            <strong>Laporan Penjualan</strong>
                            Periode Filter: ${periodeBulan} ${periodeTahun}<br>
                            Dicetak: ${printDate}
                        </div>
                    </header>
                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Omset Terfilter</div>
                            <div class="summary-value highlight">Rp ${laporanTotalOmset.toLocaleString('id-ID')}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Transaksi</div>
                            <div class="summary-value">${pesananLaporanFiltered.length}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Menu Terlaris</div>
                            <div class="summary-value" style="font-size: 14pt; padding-top: 4px;">${bestMenu}</div>
                        </div>
                    </div>
                    <h2 class="section-title">Detail Omset Harian</h2>
                    <table>
                        <thead>
                            <tr><th>Tanggal</th><th>Jumlah Transaksi</th><th class="text-right">Omset Harian (Rp)</th></tr>
                        </thead>
                        <tbody>
                            ${tbodyHtml}
                            <tr>
                                <td colspan="2" class="font-bold text-right" style="background-color: #FAFAFA; border-top: 2px solid #111;">TOTAL KESELURUHAN</td>
                                <td class="font-bold text-right highlight" style="background-color: #FAFAFA; border-top: 2px solid #111;">${laporanTotalOmset.toLocaleString('id-ID')}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="signature-block">
                        <div class="signature-box">
                            <div class="signature-line">Admin Mie Jebew</div>
                            <div class="signature-role">Manajer Operasional</div>
                        </div>
                    </div>
                </div>
                <footer class="page-footer">
                    <span>Mie Jebew Gorontalo - Laporan Internal</span>
                    <span>Dicetak: ${printDate}</span>
                </footer>
            </div>
        </body>
        </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHTML);
        printWindow.document.close();
    };

    const downloadCSV = () => {
        if (pesananLaporanFiltered.length === 0) { alert("Data kosong, tidak ada yang bisa diunduh."); return; }
        
        // 1. Tambahkan header "No HP" di urutan CSV
        let csvContent = "data:text/csv;charset=utf-8,Timestamp,Nama Pemesan,No HP,Alamat,Detail Pesanan,Kloter,Total Harga\r\n";
        
        pesananLaporanFiltered.forEach(row => {
            const escapedAlamat = `"${(row.Alamat || "").replace(/"/g, '""')}"`;
            const escapedDetail = `"${(row.DetailPesanan || "").replace(/"/g, '""')}"`;
            const noHpAman = row.NoHp ? `'${row.NoHp}` : '-'; 
            
            // 2. Sisipkan row.NoHp ke dalam baris data
            csvContent += `${row.Timestamp},${row.NamaPemesan},${noHpAman},${escapedAlamat},${escapedDetail},${row.Kloter},${row.TotalHarga}\r\n`;
        });
        
        const namaBulanStr = filterBulan !== 'semua' ? `_Bulan-${filterBulan}` : '';
        const namaTahunStr = filterTahun !== 'semua' ? `_Tahun-${filterTahun}` : '';

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Mie_Jebew${namaBulanStr}${namaTahunStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // === RENDER LAYAR LOGIN ===
    if (!isLoggedIn) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4 bg-bvcream">
                <form onSubmit={handleLogin} className="bg-white border-4 border-bvblack shadow-brutal-lg p-8 md:p-10 w-full max-w-sm text-center">
                    <h1 className="text-4xl font-display text-bvblack mb-2 uppercase">ADMIN <span className="text-bvred">MIE JEBEW.</span></h1>
                    <p className="font-bold text-gray-500 mb-8">AREA TERBATAS</p>
                    <input type="password" required value={pin} onChange={e => setPin(e.target.value)} placeholder="MASUKKAN PIN" className="w-full border-4 border-bvblack p-4 mb-4 text-center tracking-widest text-xl font-bold focus:outline-none bg-bvcream shadow-[4px_4px_0_0_#111]" />
                    <button type="submit" disabled={isVerifying} className="bg-bvred text-white border-4 border-bvblack p-4 font-display text-xl w-full uppercase shadow-[4px_4px_0_0_#111] hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50">
                        {isVerifying ? 'MEMERIKSA...' : 'LOGIN'}
                    </button>
                    {loginError && <p className="text-bvred mt-4 font-bold uppercase">{loginError}</p>}
                </form>
            </div>
        );
    }

    // === RENDER LAYOUT DASHBOARD ===
    return (
        <div className="flex h-screen w-full bg-bvcream overflow-hidden">
            {isSidebarOpen && <div className="fixed inset-0 bg-bvblack bg-opacity-50 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

            <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-64 bg-white border-r-4 border-bvblack flex flex-col justify-between transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div>
                    <div className="h-20 flex items-center px-6 border-b-4 border-bvblack bg-bvyellow">
                        <h1 className="text-2xl font-display text-bvblack uppercase">ADMIN.</h1>
                    </div>
                    <nav className="p-4 space-y-3 mt-2 font-display uppercase">
                        {['overview', 'orders', 'laporan', 'foods'].map((tab) => (
                            <button key={tab} onClick={() => { setView(tab); setIsSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3 border-4 border-bvblack transition-all shadow-[2px_2px_0_0_#111] hover:translate-x-1 hover:translate-y-1 ${view === tab ? 'bg-bvred text-white' : 'bg-white text-bvblack'}`}>
                                {tab === 'overview' ? 'DASHBOARD' : tab === 'orders' ? 'LIST HARIAN' : tab === 'laporan' ? 'LAPORAN' : 'MENU STOK'}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="p-4 mb-4">
                    <button onClick={openAddModal} className="w-full bg-bvblack text-white border-4 border-bvblack p-3 font-display uppercase hover:bg-bvyellow hover:text-bvblack transition-colors shadow-[4px_4px_0_0_#111]">+ MENU BARU</button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-20 bg-white border-b-4 border-bvblack flex items-center justify-between px-6 shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden font-display text-xl bg-bvyellow border-2 border-bvblack px-3 py-1 shadow-[2px_2px_0_0_#111]">MENU</button>
                    <div className="ml-auto font-display text-lg uppercase flex items-center gap-4">
                        <span className="hidden sm:inline">HALLO, BOSS!</span>
                        <div className="w-10 h-10 bg-bvred border-2 border-bvblack text-white flex items-center justify-center shadow-[2px_2px_0_0_#111]">AD</div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    {loadingData && <p className="font-display text-xl uppercase mb-4 animate-pulse">Memuat Data dari Server...</p>}

                    {view === 'overview' && (
                        <div className="space-y-6">
                            <h2 className="text-4xl font-display uppercase border-b-4 border-bvblack pb-2">DASHBOARD</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-bvyellow p-6 border-4 border-bvblack shadow-brutal">
                                    <h3 className="text-5xl font-display">{pesananData.length}</h3>
                                    <p className="font-bold uppercase mt-2">Total Pesanan</p>
                                </div>
                                <div className="bg-bvcream p-6 border-4 border-bvblack shadow-brutal">
                                    <h3 className="text-5xl font-display text-bvred">Rp{totalPendapatanUmum.toLocaleString('id-ID')}</h3>
                                    <p className="font-bold uppercase mt-2">Total Omset</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'orders' && (
                        <div className="space-y-6">
                            <h2 className="text-4xl font-display uppercase border-b-4 border-bvblack pb-2">LIST HARIAN</h2>
                            {Object.entries(groupedByDateAll).map(([tgl, obj], idx) => (
                                <div key={idx} className="bg-white border-4 border-bvblack shadow-brutal mb-8 overflow-hidden">
                                    <div className="bg-bvblack text-white p-4 flex justify-between items-center flex-wrap gap-2 border-b-4 border-bvblack">
                                        <h4 className="font-display text-xl uppercase">📅 {tgl}</h4>
                                        <span className="bg-bvyellow text-bvblack border-2 border-bvblack px-3 py-1 font-display text-sm">OMSET: Rp{obj.subtotal.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left font-bold text-sm whitespace-nowrap">
                                            <thead className="bg-bvcream border-b-4 border-bvblack uppercase">
                                                <tr>
                                                    <th className="px-4 py-3">Nama</th>
                                                    <th className="px-4 py-3">Waktu</th>
                                                    <th className="px-4 py-3">Kloter</th>
                                                    <th className="px-4 py-3">Total</th>
                                                    <th className="px-4 py-3 text-center">Aksi</th> 
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y-2 divide-bvblack">
                                                {obj.pesanan.map((p, i) => (
                                                    <tr key={i} className="hover:bg-gray-100">
                                                        <td className="px-4 py-3">{p.NamaPemesan}</td>
                                                        <td className="px-4 py-3 text-gray-500">{p.jam}</td>
                                                        <td className="px-4 py-3"><span className="bg-bvred text-white px-2 border-2 border-bvblack">{p.Kloter}</span></td>
                                                        <td className="px-4 py-3 text-bvred">Rp{parseInt(p.TotalHarga || 0).toLocaleString('id-ID')}</td>
                                                        <td className="px-4 py-3">
                                                            <a
                                                                href={`https://wa.me/${formatWA(p.NoHp)}?text=${encodeURIComponent(`Halo *${p.NamaPemesan}*, pesanan Mie Jebew kamu untuk *Kloter ${p.Kloter}* sudah kami terima dan sedang diproses. Mohon ditunggu ya! 🔥`)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-[#25D366] text-white font-bold border-2 border-bvblack px-3 py-1 shadow-[2px_2px_0_0_#111] hover:bg-green-600 transition-colors uppercase text-xs"
                                                            >
                                                                Chat WA
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'laporan' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b-4 border-bvblack pb-4">
                                <h2 className="text-4xl font-display uppercase">LAPORAN</h2>
                                
                                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                    <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)} className="bg-white border-4 border-bvblack px-4 py-2 font-bold focus:outline-none shadow-[2px_2px_0_0_#111]">
                                        <option value="semua">Semua Bulan</option>
                                        <option value="1">Januari</option>
                                        <option value="2">Februari</option>
                                        <option value="3">Maret</option>
                                        <option value="4">April</option>
                                        <option value="5">Mei</option>
                                        <option value="6">Juni</option>
                                        <option value="7">Juli</option>
                                        <option value="8">Agustus</option>
                                        <option value="9">September</option>
                                        <option value="10">Oktober</option>
                                        <option value="11">November</option>
                                        <option value="12">Desember</option>
                                    </select>

                                    <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="bg-white border-4 border-bvblack px-4 py-2 font-bold focus:outline-none shadow-[2px_2px_0_0_#111]">
                                        <option value="semua">Semua Tahun</option>
                                        {availableYears.map(yr => (
                                            <option key={yr} value={yr}>{yr}</option>
                                        ))}
                                    </select>
                                    
                                    <button onClick={cetakPDF} className="bg-bvred text-white px-6 py-2 font-display uppercase hover:bg-bvblack transition-colors shadow-[4px_4px_0_0_#111]">🖨️ CETAK PDF</button>
                                    <button onClick={downloadCSV} className="bg-bvblack text-white px-6 py-2 font-display uppercase hover:bg-bvred transition-colors shadow-[4px_4px_0_0_#111]">💾 UNDUH CSV</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="bg-white p-6 border-4 border-bvblack shadow-brutal flex justify-between items-center">
                                    <div>
                                        <p className="font-bold uppercase text-gray-500">Omset Terfilter</p>
                                        <h3 className="text-4xl font-display text-bvred mt-1">Rp{laporanTotalOmset.toLocaleString('id-ID')}</h3>
                                    </div>
                                    <div className="text-5xl">💰</div>
                                </div>
                                <div className="bg-white p-6 border-4 border-bvblack shadow-brutal flex justify-between items-center">
                                    <div>
                                        <p className="font-bold uppercase text-gray-500">Transaksi Terfilter</p>
                                        <h3 className="text-4xl font-display text-bvblack mt-1">{pesananLaporanFiltered.length} Pesanan</h3>
                                    </div>
                                    <div className="text-5xl">📝</div>
                                </div>
                            </div>

                            <div className="bg-white border-4 border-bvblack shadow-brutal overflow-hidden mt-6">
                                <table className="w-full text-left font-bold text-sm whitespace-nowrap">
                                    <thead className="bg-bvyellow border-b-4 border-bvblack font-display uppercase">
                                        <tr><th className="px-6 py-4">Tanggal</th><th className="px-6 py-4">Jumlah Transaksi</th><th className="px-6 py-4">Omset Harian</th></tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-bvblack">
                                        {Object.entries(laporanGroupedHarian).length === 0 ? (
                                            <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">Tidak ada data di periode ini.</td></tr>
                                        ) : (
                                            Object.entries(laporanGroupedHarian).map(([tgl, stat], idx) => (
                                                <tr key={idx} className="hover:bg-gray-100">
                                                    <td className="px-6 py-4">{tgl}</td>
                                                    <td className="px-6 py-4">{stat.count} Pesanan</td>
                                                    <td className="px-6 py-4 text-bvred text-lg">Rp{stat.subtotal.toLocaleString('id-ID')}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {view === 'foods' && (
                        <div className="space-y-6">
                            <h2 className="text-4xl font-display uppercase border-b-4 border-bvblack pb-2">MANAJEMEN MENU</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {menuData.map(menu => (
                                    <div key={menu.ID} className="bg-white border-4 border-bvblack shadow-brutal p-4 flex flex-col justify-between">
                                        <div className="w-full h-48 border-4 border-bvblack mb-4 relative bg-bvcream overflow-hidden">
                                            <img src={menu.Gambar ? formatImg(menu.Gambar) : 'https://placehold.co/400x300'} className="w-full h-full object-cover grayscale-[20%]" alt={menu.Nama} />
                                            <div className="absolute top-2 right-2 flex gap-2">
                                                <button onClick={() => openEditModal(menu)} className="bg-bvyellow border-2 border-bvblack p-2 hover:bg-white">✏️</button>
                                                <button onClick={() => hapusMenu(menu.ID)} className="bg-bvred border-2 border-bvblack p-2 hover:bg-bvblack text-white">🗑️</button>
                                            </div>
                                        </div>
                                        <h3 className="font-display text-xl uppercase leading-tight mb-2">{menu.Nama}</h3>
                                        <p className="font-bold text-bvred text-xl mb-4">Rp{parseInt(menu.Harga).toLocaleString('id-ID')}</p>
                                        <div className="mt-auto bg-bvcream border-4 border-bvblack p-2 flex items-center">
                                            <span className="font-bold mr-2">STOK:</span>
                                            <input type="number" defaultValue={menu.Stok} onBlur={(e) => {
                                                fetch('/api/gas', { method:'POST', body: JSON.stringify({action: 'updateStok', id: menu.ID, stokBaru: e.target.value, pin})});
                                            }} className="w-full bg-transparent font-bold text-lg focus:outline-none" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal Tambah/Edit Menu */}
            {showModal && (
                <div className="fixed inset-0 bg-bvblack bg-opacity-70 z-50 flex items-center justify-center p-4">
                    <div className="bg-white border-4 border-bvblack shadow-brutal-lg p-6 w-full max-w-md">
                        <h3 className="text-3xl font-display uppercase mb-6">{editId ? 'EDIT MENU' : 'MENU BARU'}</h3>
                        <form onSubmit={simpanMenu} className="space-y-4 font-bold">
                            <input type="text" required placeholder="NAMA MENU" value={formMenu.nama} onChange={e=>setFormMenu({...formMenu, nama: e.target.value})} className="w-full border-4 border-bvblack p-3 bg-bvcream focus:bg-white outline-none" />
                            <input type="text" required placeholder="DESKRIPSI" value={formMenu.deskripsi} onChange={e=>setFormMenu({...formMenu, deskripsi: e.target.value})} className="w-full border-4 border-bvblack p-3 bg-bvcream focus:bg-white outline-none" />
                            <div className="flex gap-4">
                                <input type="number" required placeholder="HARGA" value={formMenu.harga} onChange={e=>setFormMenu({...formMenu, harga: e.target.value})} className="w-full border-4 border-bvblack p-3 bg-bvcream focus:bg-white outline-none" />
                                <input type="number" required placeholder="STOK" value={formMenu.stok} onChange={e=>setFormMenu({...formMenu, stok: e.target.value})} className="w-full border-4 border-bvblack p-3 bg-bvcream focus:bg-white outline-none" />
                            </div>
                            <input type="text" placeholder="URL GAMBAR (Postimg.cc / GDrive)" value={formMenu.gambar} onChange={e=>setFormMenu({...formMenu, gambar: e.target.value})} className="w-full border-4 border-bvblack p-3 bg-bvcream focus:bg-white outline-none" />
                            
                            <div className="flex gap-4 mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border-4 border-bvblack p-3 hover:bg-bvcream">BATAL</button>
                                <button type="submit" disabled={isSaving} className="flex-1 bg-bvred text-white border-4 border-bvblack p-3 font-display uppercase hover:bg-bvblack disabled:opacity-50">
                                    {isSaving ? 'MENYIMPAN...' : 'SIMPAN'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}