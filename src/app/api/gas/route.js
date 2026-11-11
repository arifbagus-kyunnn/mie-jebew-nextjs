import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'getMenu';
        const pin = searchParams.get('pin') || '';

        const response = await fetch(`${process.env.GOOGLE_SCRIPT_URL}?action=${action}&pin=${pin}`);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ result: "error", message: "Gagal fetch GET" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();

        const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ result: "error", message: "Gagal fetch POST" }, { status: 500 });
    }
}