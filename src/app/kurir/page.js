"use client";
import { useState } from 'react';

export default function KurirDashboard() {
    // State Login
    const [pin, setPin] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // State Data
    const [pesananData, setPesananData] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    // === FUNGSI LOGIN & FETCH ===
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsVerifying(true);
        setLoginError('');
        try {
            // Tembak ke API Proxy kita
            const res = await fetch(`/api/gas?action=loginKurir&pin=${pin}`);
            const data = await res.json();
            
            if (data.result === 'success') {
                setIsLoggedIn(true);
                fetchPesanan(pin);
            } else {
                setLoginError('PIN KURIR SALAH!');
            }
        } catch (err) {
            setLoginError('Gagal menghubungi server!');
        }
        setIsVerifying(false);
    };

    const fetchPesanan = async (pinKurir) => {
        setLoadingData(true);
        try {
            const res = await fetch(`/api/gas?action=getPesananKurir&pin=${pinKurir}`);
            const data = await res.json();
            
            if (data.result === 'success') {
                // Reverse agar pesanan terbaru ada di atas
                setPesananData(data.data.reverse());
            }
        } catch (err) {
            console.error("Gagal memuat data", err);
        }
        setLoadingData(false);
    };

    // === LOGIKA PENGELOMPOKAN HARIAN ===
    const groupedByDate = pesananData.reduce((acc, row) => {
        const dateObj = new Date(row.Timestamp);
        const tglKey = isNaN(dateObj) ? "Tanggal Tidak Diketahui" : dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        
        if (!acc[tglKey]) acc[tglKey] = [];
        acc[tglKey].push(row);
        return acc;
    }, {});


    // === RENDER LAYAR LOGIN ===
    if (!isLoggedIn) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4 bg-bvcream">
                <form onSubmit={handleLogin} className="bg-white border-4 border-bvblack shadow-brutal-lg p-8 md:p-10 w-full max-w-sm text-center">
                    <div className="text-6xl mb-4">🛵</div>
                    <h1 className="text-4xl font-display text-bvblack mb-2 uppercase">KURIR AREA</h1>
                    <p className="font-bold text-gray-500 mb-8 uppercase">Masukkan PIN Kurir</p>
                    <input 
                        type="password" 
                        required 
                        value={pin} 
                        onChange={e => setPin(e.target.value)} 
                        placeholder="PIN KURIR" 
                        className="w-full border-4 border-bvblack p-4 mb-4 text-center tracking-widest text-xl font-bold focus:outline-none bg-bvcream shadow-[4px_4px_0_0_#111]" 
                    />
                    <button 
                        type="submit" 
                        disabled={isVerifying} 
                        className="bg-bvblack text-white border-4 border-bvblack p-4 font-display text-xl w-full uppercase shadow-[4px_4px_0_0_#111] hover:bg-bvred hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50"
                    >
                        {isVerifying ? 'MEMERIKSA...' : 'MASUK'}
                    </button>
                    {loginError && <p className="text-bvred mt-4 font-bold uppercase">{loginError}</p>}
                </form>
            </div>
        );
    }

    // === RENDER DASHBOARD KURIR ===
    return (
        <div className="min-h-screen bg-bvcream font-body text-bvblack p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                
                {/* Header Kurir */}
                <header className="bg-bvyellow border-4 border-bvblack shadow-brutal p-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-display uppercase">🛵 LIST PENGIRIMAN</h1>
                        <p className="text-sm font-bold mt-1 uppercase">Fokus Alamat & Kloter</p>
                    </div>
                    <button 
                        onClick={() => fetchPesanan(pin)} 
                        className="bg-white border-4 border-bvblack px-6 py-3 font-display uppercase shadow-[4px_4px_0_0_#111] hover:bg-bvblack hover:text-white transition-colors flex-shrink-0"
                    >
                        SEGAR KAN (REFRESH)
                    </button>
                </header>

                {/* List Pengiriman Terkelompok */}
                <div className="space-y-10">
                    {loadingData ? (
                        <div className="text-center py-10 font-display text-xl uppercase animate-pulse">Memuat daftar tugas...</div>
                    ) : pesananData.length === 0 ? (
                        <div className="bg-white border-4 border-bvblack p-10 text-center font-display text-2xl uppercase shadow-brutal">
                            🎉 Belum ada tugas pengiriman. Santai dulu!
                        </div>
                    ) : (
                        Object.entries(groupedByDate).map(([tgl, pesananHarian], idx) => (
                            <div key={idx} className="relative">
                                {/* Header Tanggal */}
                                <div className="inline-block bg-bvblack text-white font-display text-xl md:text-2xl uppercase px-6 py-3 border-4 border-bvblack shadow-[4px_4px_0_0_#FF2A2A] mb-6 transform -rotate-1">
                                    📅 {tgl}
                                </div>
                                
                                {/* Kartu Pesanan di Tanggal Tersebut */}
                                <div className="space-y-6">
                                    {pesananHarian.map((item, i) => (
                                        <div key={i} className="bg-white border-4 border-bvblack shadow-brutal p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div className="space-y-3 flex-1 w-full">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="bg-bvred text-white text-sm font-display px-3 py-1 uppercase border-4 border-bvblack shadow-[2px_2px_0_0_#111]">
                                                        {item.Kloter}
                                                    </span>
                                                    <h3 className="font-display text-2xl uppercase leading-none break-words w-full sm:w-auto">{item.NamaPemesan}</h3>
                                                </div>
                                                <div className="bg-bvcream p-4 border-4 border-bvblack">
                                                    <p className="text-sm font-bold uppercase text-gray-500 mb-1">📍 Alamat Tujuan:</p>
                                                    <p className="font-bold text-lg whitespace-pre-wrap leading-snug">{item.Alamat}</p>
                                                </div>
                                                <p className="text-sm font-bold border-l-4 border-bvblack pl-3 text-gray-600">
                                                    📦 Bawaan: {item.DetailPesanan}
                                                </p>
                                            </div>
                                            <div className="w-full md:w-auto flex flex-col gap-2 shrink-0">
                                                <a 
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.Alamat)}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="bg-bvblack text-white border-4 border-bvblack px-6 py-4 font-display text-lg uppercase text-center shadow-[4px_4px_0_0_#111] hover:bg-bvred transition-colors block w-full"
                                                >
                                                    BUKA MAPS 🧭
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}