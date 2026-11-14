"use client";
import { useState, useEffect, useRef } from 'react';

export default function Home() {
    const [menuProduk, setMenuProduk] = useState([]);
    const [cart, setCart] = useState([]);
    const [isCartLoaded, setIsCartLoaded] = useState(false); // <-- Gembok Pengaman LocalStorage
    const [loading, setLoading] = useState(true);

    // Form Checkout States
    const [nama, setNama] = useState('');
    const [noHp, setNoHp] = useState('');
    const [alamat, setAlamat] = useState('');
    const [kloter, setKloter] = useState('');
    const [statusPesan, setStatusPesan] = useState('');
    const [koordinat, setKoordinat] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Waktu & Penguncian Kloter
    const [jamSekarang, setJamSekarang] = useState(0);

    // Map States
    const [isMapOpen, setIsMapOpen] = useState(false);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Ambil waktu saat ini untuk mengunci kloter yang sudah lewat
        const currentHour = new Date().getHours();
        setJamSekarang(currentHour);
        
        // Auto-select kloter yang masih tersedia
        if (currentHour < 12) setKloter('Zuhur');
        else if (currentHour < 15) setKloter('Ashar');
        else if (currentHour < 19) setKloter('Isya');
        else setKloter(''); 

        // 1. Tarik Data Keranjang Lama (Jika Ada)
        const savedCart = JSON.parse(localStorage.getItem('mieJebewCart')) || [];
        setCart(savedCart);
        setIsCartLoaded(true); // Buka gembok setelah data lama ditarik

        // Fetch Menu
        fetch('/api/gas?action=getMenu')
            .then(res => res.json())
            .then(data => {
                if (data.result === 'success') setMenuProduk(data.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // 2. Simpan ke LocalStorage HANYA jika gembok sudah terbuka
    useEffect(() => {
        if (isCartLoaded) {
            localStorage.setItem('mieJebewCart', JSON.stringify(cart));
        }
    }, [cart, isCartLoaded]);

    const formatImg = (url) => {
        if (!url || url.trim() === "") return "";
        if (url.includes("drive.google.com/file/d/")) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
        }
        return url.trim();
    };

    // --- LOGIKA KERANJANG ---
    const addToCart = (produk) => {
        setCart(prev => {
            const existing = prev.find(item => item.ID === produk.ID);
            if (existing) {
                if (existing.qty >= parseInt(produk.Stok)) {
                    alert(`Maksimal ${produk.Stok} porsi.`);
                    return prev;
                }
                return prev.map(item => item.ID === produk.ID ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...produk, qty: 1 }];
        });
    };

    const minCart = (id) => {
        setCart(prev => {
            const existing = prev.find(item => item.ID === id);
            if (existing.qty > 1) {
                return prev.map(item => item.ID === id ? { ...item, qty: item.qty - 1 } : item);
            }
            return prev.filter(item => item.ID !== id);
        });
    };

    const totalRupiah = cart.reduce((sum, item) => sum + (parseInt(item.Harga) * item.qty), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    // --- LOGIKA PETA (Leaflet, GPS, Search) ---
    const handleBukaPeta = () => {
        setIsMapOpen(true);
        setTimeout(() => {
            if (typeof window !== 'undefined' && window.L && !mapInstance.current) {
                const map = window.L.map(mapRef.current).setView([0.5401, 123.0595], 14);
                window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                const mark = window.L.marker([0.5401, 123.0595], { draggable: true }).addTo(map);
                
                mark.on('dragend', () => terjemahkanKoordinat(mark.getLatLng().lat, mark.getLatLng().lng));
                map.on('click', (e) => { mark.setLatLng(e.latlng); terjemahkanKoordinat(e.latlng.lat, e.latlng.lng); });
                
                mapInstance.current = map;
                markerInstance.current = mark;

                handleGpsSaya();
            }
        }, 300);
    };

    const handleGpsSaya = () => {
        if (navigator.geolocation) {
            setAlamat("Sedang mencari lokasi GPS Anda...");
            navigator.geolocation.getCurrentPosition(pos => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (mapInstance.current && markerInstance.current) {
                    mapInstance.current.setView([lat, lng], 16);
                    markerInstance.current.setLatLng([lat, lng]);
                }
                terjemahkanKoordinat(lat, lng);
            }, () => {
                alert("Akses lokasi ditolak atau tidak didukung.");
                setAlamat("");
            });
        }
    };

    const handleCariLokasi = async () => {
        if (!searchQuery) return;
        setAlamat("Mencari area...");
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery + ', Gorontalo')}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                if (mapInstance.current && markerInstance.current) {
                    mapInstance.current.setView([lat, lng], 17);
                    markerInstance.current.setLatLng([lat, lng]);
                }
                terjemahkanKoordinat(lat, lng);
            } else {
                alert(`Area "${searchQuery}" tidak ditemukan di Gorontalo.`);
                setAlamat("");
            }
        } catch (err) {
            alert("Gagal menghubungi server pencarian peta.");
        }
    };

    const terjemahkanKoordinat = async (lat, lng) => {
        setKoordinat(`${lat},${lng}`);
        
        const teksLama = alamat;
        let teksPatokan = "";
        if (teksLama.includes("[Patokan:")) {
            teksPatokan = "\n" + teksLama.substring(teksLama.indexOf("[Patokan:"));
        } else if (teksLama && !teksLama.includes("Titik Koordinat") && !teksLama.includes("Sedang mencari")) {
            teksPatokan = "\n[Patokan: " + teksLama + "]";
        }

        setAlamat("Menerjemahkan nama jalan...");
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            setAlamat((data.display_name || `Titik Koordinat: ${lat}, ${lng}`) + teksPatokan);
        } catch (err) {
            setAlamat(`Titik Koordinat: ${lat}, ${lng}` + teksPatokan);
        }
    };

    // --- LOGIKA CHECKOUT ---
    const handleCheckout = async (e) => {
        e.preventDefault();
        if (cart.length === 0) return;
        if (!kloter) {
            alert("Maaf, semua kloter pengiriman untuk hari ini sudah tutup!");
            return;
        }

        setIsProcessing(true);
        setStatusPesan('Memproses pesanan...');

        const detailStr = cart.map(item => `${item.qty}x ${item.Nama}`).join(", ");
        
        try {
            const res = await fetch('/api/gas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'checkout',
                    nama, noHp, alamat, kloter, totalHarga: totalRupiah,
                    detailPesanan: detailStr, items: cart
                })
            });
            const data = await res.json();
            
            if(data.result === 'success'){
                setStatusPesan('Berhasil! Buka WhatsApp...');
                const linkMaps = koordinat ? `\n📍 *Lokasi Maps:*\nhttps://www.google.com/maps/search/?api=1&query=${koordinat}` : '';
                const waText = `Halo admin Mie Jebew, saya pesan:\n\nNama: ${nama}\nNo. HP: ${noHp}\nKloter: ${kloter}\nPesanan: ${detailStr}\nTotal: Rp${totalRupiah.toLocaleString('id-ID')}\n\n*Alamat:*\n${alamat}${linkMaps}`;
                
                setTimeout(() => {
                    setCart([]);
                    window.location.href = `https://wa.me/6285343631117?text=${encodeURIComponent(waText)}`;
                    setIsProcessing(false);
                }, 1000);
            } else {
                throw new Error("Gagal di server");
            }
        } catch (err) {
            setStatusPesan('Gagal. Periksa koneksi internet Anda.');
            setIsProcessing(false);
        }
    };

    return (
        <>
            <nav className="bg-bvcream border-b-4 border-bvblack fixed w-full z-50 top-0 transition-all">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-bvred border-2 border-bvblack p-1.5 shadow-brutal transform -rotate-3">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </div>
                        <h1 className="text-3xl font-display text-bvblack tracking-tighter uppercase mt-1">MIE JEBEW.</h1>
                    </div>
                    <a href="#cart-section" className="relative bg-white border-2 border-bvblack hover:bg-bvyellow text-bvblack p-3 shadow-brutal hover:shadow-brutal-hover transition-all duration-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="absolute -top-3 -right-3 bg-bvred text-white text-xs font-display rounded-none px-2 py-0.5 border-2 border-bvblack">{totalItems}</span>
                    </a>
                </div>
            </nav>

            <header className="pt-32 pb-16 px-6 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12 relative">
                <div className="md:w-1/2 space-y-8 text-center md:text-left z-10">
                    <div className="inline-block bg-bvyellow border-2 border-bvblack px-4 py-1 font-bold text-bvblack shadow-[3px_3px_0px_0px_#111] transform -rotate-2">
                        🌶️ THE SPICIEST IN TOWN
                    </div>
                    <h2 className="text-6xl md:text-7xl lg:text-8xl font-display text-bvblack leading-[0.9] uppercase">
                        PEDASNYA<br />
                        <span className="text-bvred" style={{textShadow: "4px 4px 0 #111, -1px -1px 0 #111, 1px -1px 0 #111, -1px 1px 0 #111, 1px 1px 0 #111"}}>BRUTAL.</span>
                    </h2>
                    <p className="text-bvblack font-semibold text-lg md:text-xl max-w-md mx-auto md:mx-0 border-l-4 border-bvred pl-4">
                        Pesan sekarang tanpa antre. Pilih level pedasmu, tentukan kloter, dan rasakan ledakannya di rumah.
                    </p>
                    <div className="pt-2">
                        <a href="#menu-section" className="bg-bvred border-4 border-bvblack text-white font-display text-xl py-4 px-10 shadow-brutal-lg hover:shadow-brutal hover:translate-y-1 hover:translate-x-1 transition-all duration-200 inline-block uppercase">
                            ORDER SEKARANG
                        </a>
                    </div>
                </div>
                <div className="md:w-1/2 relative w-full h-[400px] flex justify-center items-center">
                    <div className="absolute inset-0 bg-bvred border-4 border-bvblack shadow-brutal-lg transform rotate-6 w-full max-w-sm mx-auto h-[350px]"></div>
                    <div className="absolute inset-0 bg-bvyellow border-4 border-bvblack shadow-brutal transform -rotate-3 w-full max-w-sm mx-auto h-[350px]"></div>
                    <img src="https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Mie Jebew Bowl" className="relative z-10 w-full max-w-sm mx-auto object-cover h-[350px] border-4 border-bvblack shadow-brutal grayscale-[20%] contrast-125 hover:grayscale-0 transition duration-300" />
                </div>
            </header>

            <div className="marquee overflow-hidden whitespace-nowrap w-full border-y-4 border-bvblack bg-bvyellow py-3 mt-8">
                <div className="marquee-content inline-block animate-marquee">
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🔥 100% PEDAS ASLI</span>
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🍝 MIE JEBEW GORONTALO</span>
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🛵 DELIVERY CEPAT</span>
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🌶️ BERANI COBA?</span>
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🔥 100% PEDAS ASLI</span>
                    <span className="font-display text-2xl text-bvblack mr-12 uppercase">🍝 MIE JEBEW GORONTALO</span>
                </div>
            </div>

            <section id="menu-section" className="py-20 bg-bvcream">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="mb-16 flex flex-col items-center">
                        <h3 className="text-5xl md:text-6xl font-display text-bvblack uppercase text-center">MENU KAMI</h3>
                        <div className="h-2 w-32 bg-bvred border-2 border-bvblack mt-6 shadow-[2px_2px_0_0_#111]"></div>
                    </div>
                    
                    {loading ? (
                        <div className="text-center py-10 font-bold uppercase text-xl animate-pulse">MEMUAT KATALOG...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                            {menuProduk.map(produk => {
                                const stok = parseInt(produk.Stok) || 0;
                                const isHabis = stok <= 0;
                                const imgUrl = produk.Gambar ? formatImg(produk.Gambar) : 'https://placehold.co/400x300?text=Mie+Jebew';
                                
                                return (
                                    <div key={produk.ID} className="bg-white border-4 border-bvblack p-4 flex flex-col justify-between overflow-hidden shadow-brutal hover:shadow-brutal-hover hover:translate-y-1 hover:translate-x-1 transition-all duration-200 group">
                                        <div className="w-full h-56 border-4 border-bvblack overflow-hidden mb-5 relative bg-bvcream">
                                            <img src={imgUrl} className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition duration-500" alt={produk.Nama} />
                                            <div className={`absolute top-2 right-2 border-2 border-bvblack ${isHabis ? 'bg-bvblack text-white' : 'bg-bvyellow text-bvblack'} px-3 py-1 font-display uppercase text-sm`}>
                                                {isHabis ? 'HABIS' : `SISA ${stok}`}
                                            </div>
                                        </div>
                                        <div className="flex-1 flex flex-col">
                                            <h3 className="font-display text-2xl uppercase text-bvblack leading-tight mb-2">{produk.Nama}</h3>
                                            <p className="text-sm font-bold text-gray-600 mb-4 border-l-4 border-bvred pl-3 line-clamp-2">{produk.Deskripsi}</p>
                                            <div className="mt-auto">
                                                <p className="font-display text-3xl text-bvred mb-4" style={{textShadow: "1px 1px 0px #111"}}>Rp{parseInt(produk.Harga).toLocaleString('id-ID')}</p>
                                            </div>
                                        </div>
                                        <div className="mt-auto">
                                            {isHabis ? (
                                                <button disabled className="w-full bg-gray-300 text-gray-500 border-4 border-gray-400 py-3 font-display uppercase cursor-not-allowed">SOLD OUT</button>
                                            ) : (
                                                <button onClick={() => addToCart(produk)} className="w-full bg-bvblack text-white border-4 border-bvblack py-3 font-display uppercase hover:bg-bvred transition-colors shadow-[4px_4px_0_0_#111]">TAMBAH</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </section>

            <section id="cart-section" className="py-20 bg-white border-t-4 border-bvblack">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="mb-12"><h3 className="text-5xl md:text-6xl font-display text-bvblack uppercase">CHECKOUT.</h3></div>
                    <div className="flex flex-col lg:flex-row gap-10">
                        {/* Keranjang Kiri */}
                        <div className="lg:w-5/12 bg-bvyellow border-4 border-bvblack shadow-brutal p-6 md:p-8 flex flex-col h-fit">
                            <h4 className="text-2xl font-display uppercase mb-6 border-b-4 border-bvblack pb-4">YOUR CART</h4>
                            <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                                {cart.length === 0 ? (
                                    <p className="text-bvblack font-bold text-center py-10 uppercase">KOSONG. AYO PESAN!</p>
                                ) : (
                                    cart.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-white p-4 border-4 border-bvblack shadow-[2px_2px_0_0_#111] mb-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-bvblack">{item.Nama}</p>
                                                <p className="text-xs font-bold text-bvred">Rp{parseInt(item.Harga).toLocaleString('id-ID')}</p>
                                            </div>
                                            <div className="flex items-center border-2 border-bvblack bg-white">
                                                <button type="button" onClick={() => minCart(item.ID)} className="px-3 py-1 font-bold hover:bg-gray-100">-</button>
                                                <span className="px-3 py-1 font-bold text-sm border-l-2 border-r-2 border-bvblack">{item.qty}</span>
                                                <button type="button" onClick={() => addToCart(item)} className="px-3 py-1 font-bold hover:bg-gray-100">+</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="mt-6 pt-6 border-t-4 border-bvblack">
                                <div className="flex justify-between items-center text-2xl font-display uppercase">
                                    <span>TOTAL:</span>
                                    <span className="text-bvred" style={{textShadow: "2px 2px 0px #111, -1px -1px 0px #111, 1px -1px 0px #111, -1px 1px 0px #111, 1px 1px 0px #111"}}>Rp{totalRupiah.toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Form Kanan */}
                        <div className="lg:w-7/12 bg-white border-4 border-bvblack shadow-brutal p-6 md:p-8">
                            <form onSubmit={handleCheckout} className="space-y-6">
                                <div>
                                    <label className="block text-xl font-display uppercase mb-2">SIAPA NAMA KAMU?</label>
                                    <input type="text" required placeholder="NAMA LENGKAP" value={nama} onChange={(e)=>setNama(e.target.value)} className="w-full bg-bvcream border-4 border-bvblack p-4 font-bold focus:bg-white focus:outline-none shadow-[4px_4px_0_0_#111]" />
                                </div>
                                <div>
                                    <label className="block text-xl font-display uppercase mb-2">NOMOR WHATSAPP</label>
                                    <input 
                                        type="tel" 
                                        required 
                                        placeholder="CONTOH: 0853436..." 
                                        value={noHp} 
                                        onChange={(e)=>setNoHp(e.target.value)} 
                                        className="w-full bg-bvcream border-4 border-bvblack p-4 font-bold focus:bg-white focus:outline-none shadow-[4px_4px_0_0_#111]" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xl font-display uppercase mb-2">KIRIM KE MANA?</label>
                                    <button type="button" onClick={handleBukaPeta} className="w-full bg-bvblack text-white border-4 border-bvblack py-3 font-display uppercase hover:bg-bvred flex justify-center items-center gap-2 mb-4 shadow-[4px_4px_0_0_#111]">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        BUKA PETA LOKASI
                                    </button>
                                    
                                    {isMapOpen && (
                                        <div className="flex-col gap-3 mb-4 bg-bvyellow p-4 border-4 border-bvblack shadow-[4px_4px_0_0_#111] flex">
                                            <div className="flex flex-col sm:flex-row gap-3 z-10 mb-2">
                                                <div className="flex-1 flex gap-2">
                                                    <input type="text" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="CARI NAMA JALAN..." className="w-full border-4 border-bvblack p-2 font-bold focus:outline-none bg-white" />
                                                    <button type="button" onClick={handleCariLokasi} className="bg-bvblack text-white px-6 font-display uppercase border-4 border-bvblack hover:bg-bvred transition-colors">Cari</button>
                                                </div>
                                                <button type="button" onClick={handleGpsSaya} className="bg-bvred text-white border-4 border-bvblack px-4 py-2 font-display uppercase hover:bg-bvblack transition-colors shrink-0">
                                                    GPS SAYA
                                                </button>
                                            </div>
                                            <div id="mapContainer" ref={mapRef} className="w-full h-64 border-4 border-bvblack z-0 bg-gray-200"></div>
                                        </div>
                                    )}

                                    <textarea rows="3" placeholder="PATOKAN DETAIL RUMAH (Cth: Pagar hitam, depan masjid)" required value={alamat} onChange={(e)=>setAlamat(e.target.value)} className="w-full bg-bvcream border-4 border-bvblack p-4 font-bold focus:bg-white focus:outline-none shadow-[4px_4px_0_0_#111]"></textarea>
                                </div>
                                <div>
                                    <label className="block text-xl font-display uppercase mb-2">PILIH KLOTER (HARI INI)</label>
                                    
                                    {jamSekarang >= 19 ? (
                                        <div className="bg-bvred text-white font-bold p-4 border-4 border-bvblack uppercase shadow-[4px_4px_0_0_#111]">
                                            Maaf, Semua Kloter Hari Ini Sudah Tutup!
                                        </div>
                                    ) : (
                                        <select value={kloter} onChange={(e)=>setKloter(e.target.value)} className="w-full bg-bvcream border-4 border-bvblack p-4 font-bold focus:bg-white outline-none shadow-[4px_4px_0_0_#111]">
                                            {jamSekarang < 12 && <option value="Zuhur">☀️ KLOTER ZUHUR (12:00 - 13:00)</option>}
                                            {jamSekarang < 15 && <option value="Ashar">⛅ KLOTER ASHAR (15:00 - 16:00)</option>}
                                            {jamSekarang < 19 && <option value="Isya">🌙 KLOTER ISYA (19:00 - 20:00)</option>}
                                        </select>
                                    )}
                                </div>
                                <button type="submit" disabled={isProcessing || cart.length === 0 || jamSekarang >= 19} className="w-full bg-bvred border-4 border-bvblack text-white font-display text-2xl uppercase py-5 mt-6 shadow-brutal-lg hover:translate-y-1 hover:translate-x-1 transition-all disabled:opacity-50">
                                    {isProcessing ? 'MEMPROSES...' : 'GAS PESAN!'}
                                </button>
                                {statusPesan && <div className="mt-4 text-center font-bold text-lg p-4 border-4 border-bvblack bg-bvyellow uppercase">{statusPesan}</div>}
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}