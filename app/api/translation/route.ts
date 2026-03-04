import { NextRequest, NextResponse } from "next/server";

type TranslationRequest = {
    sourceLanguage: string;
    targetLanguage: string;
    text: string;
}

export async function POST(request: NextRequest) {
    const body: TranslationRequest = await request.json();
    const { sourceLanguage, targetLanguage, text } = body;
    return NextResponse.json({ success: true, data: text });
}
