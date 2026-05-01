/**
 * Static safety UI strings and language metadata for document safety analysis.
 * Supported codes match LANGUAGE_LABELS on the translate page (excluding `auto`).
 */

import type { SafetyLegitimacy, SafetySeverity } from '@/types'

export type SafetyLang =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'zh'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'pt'
  | 'it'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'nl'
  | 'pl'
  | 'sv'
  | 'tr'
  | 'vi'

const SAFETY_LANG_VALUES: readonly SafetyLang[] = [
  'en',
  'es',
  'fr',
  'de',
  'zh',
  'zh-TW',
  'ja',
  'ko',
  'pt',
  'it',
  'ru',
  'ar',
  'hi',
  'nl',
  'pl',
  'sv',
  'tr',
  'vi',
] as const

const NORMALIZED_TO_SAFETY = new Map<string, SafetyLang>(
  SAFETY_LANG_VALUES.map((lang) => [lang.toLowerCase(), lang] as const)
)

/** Normalize a raw language code to a supported safety language; unknown codes fall back to English. */
export function getSafetyLang(raw: string | undefined): SafetyLang {
  if (raw == null || String(raw).trim() === '') return 'en'
  const key = String(raw).trim().toLowerCase().replace(/_/g, '-')
  return NORMALIZED_TO_SAFETY.get(key) ?? 'en'
}

/** English names for languages, used in the safety API system prompt (localization directive). */
export const SAFETY_LANG_NAME: Record<SafetyLang, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  tr: 'Turkish',
  vi: 'Vietnamese',
}

export type SafetyUiStrings = {
  loadingDocContext: string
  noDocText: string
  analyzing: string
  analysisFailedPrefix: string
  noAnalysisData: string
  riskLevel: string
  confidence: string
  severityPrefix: string
  urgencyPrefix: string
  legitimacyPrefix: string
  suggestedNextSteps: string
  helpfulResources: string
  noLinkedResources: string
  sectionTitle: string
  analysisFailedGeneric: string
  documentLoadFailed: string
  noNextSteps: string
  riskBodyFallback: string
}

export const SAFETY_UI_STRINGS: Record<SafetyLang, SafetyUiStrings> = {
  en: {
    loadingDocContext: 'Loading document context...',
    noDocText: 'No document text available for safety analysis.',
    analyzing: 'Analyzing document...',
    analysisFailedPrefix: 'Safety analysis could not be completed.',
    noAnalysisData: 'No analysis data available. Try again later.',
    riskLevel: 'Risk Level',
    confidence: 'Confidence',
    severityPrefix: 'Severity:',
    urgencyPrefix: 'Urgency:',
    legitimacyPrefix: 'Legitimacy:',
    suggestedNextSteps: 'Suggested Next Steps',
    helpfulResources: 'Helpful Resources',
    noLinkedResources: 'No linked resources.',
    sectionTitle: 'Safety Analysis',
    analysisFailedGeneric:
      'Safety analysis could not be completed. Please try again later.',
    documentLoadFailed:
      'We could not load the document. Please try again.',
    noNextSteps:
      'No specific next steps were generated for this document.',
    riskBodyFallback:
      'Risk category was identified, but no explanation was provided.',
  },
  es: {
    loadingDocContext: 'Cargando contexto del documento...',
    noDocText:
      'No hay texto del documento disponible para el análisis de seguridad.',
    analyzing: 'Analizando documento...',
    analysisFailedPrefix:
      'No se pudo completar el análisis de seguridad.',
    noAnalysisData:
      'No hay datos de análisis disponibles. Inténtelo de nuevo más tarde.',
    riskLevel: 'Nivel de riesgo',
    confidence: 'Confianza',
    severityPrefix: 'Gravedad:',
    urgencyPrefix: 'Urgencia:',
    legitimacyPrefix: 'Legitimidad:',
    suggestedNextSteps: 'Pasos siguientes sugeridos',
    helpfulResources: 'Recursos útiles',
    noLinkedResources: 'No hay recursos vinculados.',
    sectionTitle: 'Análisis de seguridad',
    analysisFailedGeneric:
      'No se pudo completar el análisis de seguridad. Inténtelo de nuevo más tarde.',
    documentLoadFailed:
      'No pudimos cargar el documento. Inténtelo de nuevo.',
    noNextSteps:
      'No se generaron pasos específicos para este documento.',
    riskBodyFallback:
      'Se identificó una categoría de riesgo, pero no se proporcionó explicación.',
  },
  fr: {
    loadingDocContext: 'Chargement du contexte du document...',
    noDocText:
      "Aucun texte de document disponible pour l'analyse de sécurité.",
    analyzing: 'Analyse du document en cours...',
    analysisFailedPrefix:
      "L'analyse de sécurité n'a pas pu être terminée.",
    noAnalysisData:
      "Aucune donnée d'analyse disponible. Réessayez plus tard.",
    riskLevel: 'Niveau de risque',
    confidence: 'Confiance',
    severityPrefix: 'Gravité :',
    urgencyPrefix: 'Urgence :',
    legitimacyPrefix: 'Légitimité :',
    suggestedNextSteps: 'Prochaines étapes suggérées',
    helpfulResources: 'Ressources utiles',
    noLinkedResources: 'Aucune ressource liée.',
    sectionTitle: 'Analyse de sécurité',
    analysisFailedGeneric:
      "L'analyse de sécurité n'a pas pu être terminée. Veuillez réessayer plus tard.",
    documentLoadFailed:
      "Nous n'avons pas pu charger le document. Veuillez réessayer.",
    noNextSteps:
      "Aucune étape précise n'a été générée pour ce document.",
    riskBodyFallback:
      'Une catégorie de risque a été identifiée, mais aucune explication fournie.',
  },
  de: {
    loadingDocContext: 'Dokumentkontext wird geladen...',
    noDocText:
      'Kein Dokumenttext für die Sicherheitsanalyse verfügbar.',
    analyzing: 'Dokument wird analysiert...',
    analysisFailedPrefix:
      'Die Sicherheitsanalyse konnte nicht abgeschlossen werden.',
    noAnalysisData:
      'Keine Analysedaten verfügbar. Bitte später erneut versuchen.',
    riskLevel: 'Risikostufe',
    confidence: 'Vertrauen',
    severityPrefix: 'Schwere:',
    urgencyPrefix: 'Dringlichkeit:',
    legitimacyPrefix: 'Legitimität:',
    suggestedNextSteps: 'Vorgeschlagene nächste Schritte',
    helpfulResources: 'Hilfreiche Ressourcen',
    noLinkedResources: 'Keine verknüpften Ressourcen.',
    sectionTitle: 'Sicherheitsanalyse',
    analysisFailedGeneric:
      'Die Sicherheitsanalyse konnte nicht abgeschlossen werden. Bitte versuchen Sie es später erneut.',
    documentLoadFailed:
      'Das Dokument konnte nicht geladen werden. Bitte versuchen Sie es erneut.',
    noNextSteps:
      'Für dieses Dokument wurden keine konkreten nächsten Schritte erstellt.',
    riskBodyFallback:
      'Eine Risikokategorie wurde erkannt, aber es wurde keine Erklärung geliefert.',
  },
  zh: {
    loadingDocContext: '正在加载文档上下文…',
    noDocText: '没有可用于安全分析的文档文本。',
    analyzing: '正在分析文档…',
    analysisFailedPrefix: '无法完成安全分析。',
    noAnalysisData: '暂无分析数据，请稍后重试。',
    riskLevel: '风险等级',
    confidence: '置信度',
    severityPrefix: '严重程度：',
    urgencyPrefix: '紧迫性：',
    legitimacyPrefix: '可信度：',
    suggestedNextSteps: '建议的后续步骤',
    helpfulResources: '有用资源',
    noLinkedResources: '没有关联资源。',
    sectionTitle: '安全分析',
    analysisFailedGeneric: '无法完成安全分析，请稍后重试。',
    documentLoadFailed: '无法加载文档，请重试。',
    noNextSteps: '未为此文档生成具体后续步骤。',
    riskBodyFallback: '已识别风险类别，但未提供说明。',
  },
  'zh-TW': {
    loadingDocContext: '正在載入文件情境…',
    noDocText: '沒有可供安全性分析的文件文字。',
    analyzing: '正在分析文件…',
    analysisFailedPrefix: '無法完成安全性分析。',
    noAnalysisData: '尚無分析資料，請稍後再試。',
    riskLevel: '風險等級',
    confidence: '信心度',
    severityPrefix: '嚴重程度：',
    urgencyPrefix: '緊迫性：',
    legitimacyPrefix: '可信度：',
    suggestedNextSteps: '建議的後續步驟',
    helpfulResources: '實用資源',
    noLinkedResources: '沒有連結的資源。',
    sectionTitle: '安全性分析',
    analysisFailedGeneric: '無法完成安全性分析，請稍後再試。',
    documentLoadFailed: '無法載入文件，請再試一次。',
    noNextSteps: '未為此文件產生具體的後續步驟。',
    riskBodyFallback: '已辨識風險類別，但未提供說明。',
  },
  ja: {
    loadingDocContext: 'ドキュメントのコンテキストを読み込み中…',
    noDocText: '安全性分析に利用できるドキュメント本文がありません。',
    analyzing: 'ドキュメントを分析しています…',
    analysisFailedPrefix: '安全性分析を完了できませんでした。',
    noAnalysisData:
      '分析データがありません。しばらくしてから再度お試しください。',
    riskLevel: 'リスクレベル',
    confidence: '信頼度',
    severityPrefix: '深刻度：',
    urgencyPrefix: '緊急度：',
    legitimacyPrefix: '正当性：',
    suggestedNextSteps: '推奨される次のステップ',
    helpfulResources: '役立つリソース',
    noLinkedResources: 'リンクされたリソースはありません。',
    sectionTitle: '安全性分析',
    analysisFailedGeneric:
      '安全性分析を完了できませんでした。しばらくしてから再度お試しください。',
    documentLoadFailed:
      'ドキュメントを読み込めませんでした。もう一度お試しください。',
    noNextSteps:
      'このドキュメント向けの具体的な次のステップは生成されませんでした。',
    riskBodyFallback:
      'リスクカテゴリは特定されましたが、説明は提供されていません。',
  },
  ko: {
    loadingDocContext: '문서 컨텍스트를 불러오는 중…',
    noDocText: '안전 분석에 사용할 문서 텍스트가 없습니다.',
    analyzing: '문서 분석 중…',
    analysisFailedPrefix: '안전 분석을 완료할 수 없습니다.',
    noAnalysisData: '분석 데이터가 없습니다. 나중에 다시 시도하세요.',
    riskLevel: '위험 수준',
    confidence: '신뢰도',
    severityPrefix: '심각도:',
    urgencyPrefix: '긴급도:',
    legitimacyPrefix: '정당성:',
    suggestedNextSteps: '권장 다음 단계',
    helpfulResources: '유용한 자료',
    noLinkedResources: '연결된 자료가 없습니다.',
    sectionTitle: '안전 분석',
    analysisFailedGeneric:
      '안전 분석을 완료할 수 없습니다. 나중에 다시 시도하세요.',
    documentLoadFailed: '문서를 불러올 수 없습니다. 다시 시도하세요.',
    noNextSteps:
      '이 문서에 대한 구체적인 다음 단계가 생성되지 않았습니다.',
    riskBodyFallback:
      '위험 범주는 식별되었으나 설명이 제공되지 않았습니다.',
  },
  pt: {
    loadingDocContext: 'A carregar contexto do documento...',
    noDocText:
      'Não há texto do documento disponível para análise de segurança.',
    analyzing: 'A analisar documento...',
    analysisFailedPrefix: 'Não foi possível concluir a análise de segurança.',
    noAnalysisData:
      'Não há dados de análise disponíveis. Tente novamente mais tarde.',
    riskLevel: 'Nível de risco',
    confidence: 'Confiança',
    severityPrefix: 'Gravidade:',
    urgencyPrefix: 'Urgência:',
    legitimacyPrefix: 'Legitimidade:',
    suggestedNextSteps: 'Próximos passos sugeridos',
    helpfulResources: 'Recursos úteis',
    noLinkedResources: 'Sem recursos ligados.',
    sectionTitle: 'Análise de segurança',
    analysisFailedGeneric:
      'Não foi possível concluir a análise de segurança. Tente novamente mais tarde.',
    documentLoadFailed:
      'Não foi possível carregar o documento. Tente novamente.',
    noNextSteps:
      'Não foram gerados passos específicos para este documento.',
    riskBodyFallback:
      'Foi identificada uma categoria de risco, mas não foi fornecida explicação.',
  },
  it: {
    loadingDocContext: 'Caricamento contesto documento...',
    noDocText:
      'Nessun testo del documento disponibile per l’analisi di sicurezza.',
    analyzing: 'Analisi documento in corso...',
    analysisFailedPrefix:
      'Impossibile completare l’analisi di sicurezza.',
    noAnalysisData:
      'Nessun dato di analisi disponibile. Riprovare più tardi.',
    riskLevel: 'Livello di rischio',
    confidence: 'Affidabilità',
    severityPrefix: 'Gravità:',
    urgencyPrefix: 'Urgenza:',
    legitimacyPrefix: 'Legittimità:',
    suggestedNextSteps: 'Passaggi successivi suggeriti',
    helpfulResources: 'Risorse utili',
    noLinkedResources: 'Nessuna risorsa collegata.',
    sectionTitle: 'Analisi di sicurezza',
    analysisFailedGeneric:
      'Impossibile completare l’analisi di sicurezza. Riprovare più tardi.',
    documentLoadFailed:
      'Impossibile caricare il documento. Riprovare.',
    noNextSteps:
      'Non sono stati generati passaggi specifici per questo documento.',
    riskBodyFallback:
      'È stata identificata una categoria di rischio, ma non è stata fornita alcuna spiegazione.',
  },
  ru: {
    loadingDocContext: 'Загрузка контекста документа…',
    noDocText:
      'Нет текста документа для анализа безопасности.',
    analyzing: 'Анализ документа…',
    analysisFailedPrefix: 'Не удалось завершить анализ безопасности.',
    noAnalysisData:
      'Данные анализа недоступны. Попробуйте позже.',
    riskLevel: 'Уровень риска',
    confidence: 'Уверенность',
    severityPrefix: 'Серьёзность:',
    urgencyPrefix: 'Срочность:',
    legitimacyPrefix: 'Легитимность:',
    suggestedNextSteps: 'Рекомендуемые следующие шаги',
    helpfulResources: 'Полезные ресурсы',
    noLinkedResources: 'Нет связанных ресурсов.',
    sectionTitle: 'Анализ безопасности',
    analysisFailedGeneric:
      'Не удалось завершить анализ безопасности. Попробуйте позже.',
    documentLoadFailed:
      'Не удалось загрузить документ. Попробуйте снова.',
    noNextSteps:
      'Для этого документа не сгенерированы конкретные следующие шаги.',
    riskBodyFallback:
      'Категория риска определена, но пояснение не предоставлено.',
  },
  ar: {
    loadingDocContext: 'جاري تحميل سياق المستند…',
    noDocText: 'لا يوجد نص مستند متاح لتحليل السلامة.',
    analyzing: 'جاري تحليل المستند…',
    analysisFailedPrefix: 'تعذّر إكمال تحليل السلامة.',
    noAnalysisData: 'لا تتوفر بيانات تحليل. حاول مرة أخرى لاحقًا.',
    riskLevel: 'مستوى الخطر',
    confidence: 'الثقة',
    severityPrefix: 'الخطورة:',
    urgencyPrefix: 'الإلحاح:',
    legitimacyPrefix: 'المشروعية:',
    suggestedNextSteps: 'الخطوات التالية المقترحة',
    helpfulResources: 'موارد مفيدة',
    noLinkedResources: 'لا توجد موارد مرتبطة.',
    sectionTitle: 'تحليل السلامة',
    analysisFailedGeneric:
      'تعذّر إكمال تحليل السلامة. يُرجى المحاولة لاحقًا.',
    documentLoadFailed:
      'تعذّر تحميل المستند. يُرجى المحاولة مرة أخرى.',
    noNextSteps:
      'لم يُنشَأ أي خطوات محددة لهذا المستند.',
    riskBodyFallback:
      'تم تحديد فئة الخطر، لكن لم يُقدَّم شرح.',
  },
  hi: {
    loadingDocContext: 'दस्तावेज़ संदर्भ लोड हो रहा है…',
    noDocText:
      'सुरक्षा विश्लेषण के लिए कोई दस्तावेज़ पाठ उपलब्ध नहीं है।',
    analyzing: 'दस्तावेज़ का विश्लेषण हो रहा है…',
    analysisFailedPrefix: 'सुरक्षा विश्लेषण पूरा नहीं हो सका।',
    noAnalysisData:
      'कोई विश्लेषण डेटा उपलब्ध नहीं। बाद में पुनः प्रयास करें।',
    riskLevel: 'जोखिम स्तर',
    confidence: 'विश्वास',
    severityPrefix: 'गंभीरता:',
    urgencyPrefix: 'तात्कालिकता:',
    legitimacyPrefix: 'वैधता:',
    suggestedNextSteps: 'सुझाए गए अगले चरण',
    helpfulResources: 'उपयोगी संसाधन',
    noLinkedResources: 'कोई लिंक किए गए संसाधन नहीं।',
    sectionTitle: 'सुरक्षा विश्लेषण',
    analysisFailedGeneric:
      'सुरक्षा विश्लेषण पूरा नहीं हो सका। बाद में पुनः प्रयास करें।',
    documentLoadFailed:
      'दस्तावेज़ लोड नहीं हो सका। कृपया पुनः प्रयास करें।',
    noNextSteps:
      'इस दस्तावेज़ के लिए कोई विशिष्ट अगले चरण उत्पन्न नहीं हुए।',
    riskBodyFallback:
      'जोखिम श्रेणी पहचानी गई, पर कोई स्पष्टीकरण नहीं दिया गया।',
  },
  nl: {
    loadingDocContext: 'Documentcontext laden...',
    noDocText:
      'Geen documenttekst beschikbaar voor veiligheidsanalyse.',
    analyzing: 'Document analyseren...',
    analysisFailedPrefix: 'Veiligheidsanalyse kon niet worden voltooid.',
    noAnalysisData:
      'Geen analysedata beschikbaar. Probeer het later opnieuw.',
    riskLevel: 'Risiconiveau',
    confidence: 'Vertrouwen',
    severityPrefix: 'Ernst:',
    urgencyPrefix: 'Urgentie:',
    legitimacyPrefix: 'Legitimiteit:',
    suggestedNextSteps: 'Voorgestelde vervolgstappen',
    helpfulResources: 'Nuttige bronnen',
    noLinkedResources: 'Geen gekoppelde bronnen.',
    sectionTitle: 'Veiligheidsanalyse',
    analysisFailedGeneric:
      'De veiligheidsanalyse kon niet worden voltooid. Probeer het later opnieuw.',
    documentLoadFailed:
      'We konden het document niet laden. Probeer het opnieuw.',
    noNextSteps:
      'Er zijn geen specifieke vervolgstappen voor dit document gegenereerd.',
    riskBodyFallback:
      'Er is een risicocategorie vastgesteld, maar geen toelichting gegeven.',
  },
  pl: {
    loadingDocContext: 'Wczytywanie kontekstu dokumentu...',
    noDocText:
      'Brak tekstu dokumentu do analizy bezpieczeństwa.',
    analyzing: 'Analizowanie dokumentu...',
    analysisFailedPrefix: 'Nie udało się zakończyć analizy bezpieczeństwa.',
    noAnalysisData:
      'Brak danych analizy. Spróbuj ponownie później.',
    riskLevel: 'Poziom ryzyka',
    confidence: 'Pewność',
    severityPrefix: 'Powaga:',
    urgencyPrefix: 'Pilność:',
    legitimacyPrefix: 'Legitymacja:',
    suggestedNextSteps: 'Zalecane kolejne kroki',
    helpfulResources: 'Przydatne zasoby',
    noLinkedResources: 'Brak powiązanych zasobów.',
    sectionTitle: 'Analiza bezpieczeństwa',
    analysisFailedGeneric:
      'Nie udało się zakończyć analizy bezpieczeństwa. Spróbuj ponownie później.',
    documentLoadFailed:
      'Nie udało się wczytać dokumentu. Spróbuj ponownie.',
    noNextSteps:
      'Nie wygenerowano konkretnych kolejnych kroków dla tego dokumentu.',
    riskBodyFallback:
      'Zidentyfikowano kategorię ryzyka, ale nie podano wyjaśnienia.',
  },
  sv: {
    loadingDocContext: 'Läser in dokumentkontext...',
    noDocText:
      'Ingen dokumenttext tillgänglig för säkerhetsanalys.',
    analyzing: 'Analyserar dokument...',
    analysisFailedPrefix: 'Säkerhetsanalysen kunde inte slutföras.',
    noAnalysisData:
      'Ingen analysedata tillgänglig. Försök igen senare.',
    riskLevel: 'Risknivå',
    confidence: 'Förtroende',
    severityPrefix: 'Allvar:',
    urgencyPrefix: 'Brådska:',
    legitimacyPrefix: 'Legitimitet:',
    suggestedNextSteps: 'Föreslagna nästa steg',
    helpfulResources: 'Hjälpsamma resurser',
    noLinkedResources: 'Inga länkade resurser.',
    sectionTitle: 'Säkerhetsanalys',
    analysisFailedGeneric:
      'Säkerhetsanalysen kunde inte slutföras. Försök igen senare.',
    documentLoadFailed:
      'Vi kunde inte ladda dokumentet. Försök igen.',
    noNextSteps:
      'Inga specifika nästa steg genererades för detta dokument.',
    riskBodyFallback:
      'En riskkategori identifierades, men ingen förklaring gavs.',
  },
  tr: {
    loadingDocContext: 'Belge bağlamı yükleniyor…',
    noDocText:
      'Güvenlik analizi için belge metni yok.',
    analyzing: 'Belge analiz ediliyor…',
    analysisFailedPrefix: 'Güvenlik analizi tamamlanamadı.',
    noAnalysisData:
      'Analiz verisi yok. Daha sonra tekrar deneyin.',
    riskLevel: 'Risk düzeyi',
    confidence: 'Güven',
    severityPrefix: 'Önem derecesi:',
    urgencyPrefix: 'Aciliyet:',
    legitimacyPrefix: 'Meşruiyet:',
    suggestedNextSteps: 'Önerilen sonraki adımlar',
    helpfulResources: 'Yararlı kaynaklar',
    noLinkedResources: 'Bağlantılı kaynak yok.',
    sectionTitle: 'Güvenlik analizi',
    analysisFailedGeneric:
      'Güvenlik analizi tamamlanamadı. Lütfen daha sonra tekrar deneyin.',
    documentLoadFailed: 'Belge yüklenemedi. Lütfen tekrar deneyin.',
    noNextSteps:
      'Bu belge için belirli sonraki adımlar oluşturulmadı.',
    riskBodyFallback:
      'Risk kategorisi belirlendi ancak açıklama sağlanmadı.',
  },
  vi: {
    loadingDocContext: 'Đang tải ngữ cảnh tài liệu…',
    noDocText:
      'Không có văn bản tài liệu để phân tích an toàn.',
    analyzing: 'Đang phân tích tài liệu…',
    analysisFailedPrefix: 'Không thể hoàn tất phân tích an toàn.',
    noAnalysisData:
      'Không có dữ liệu phân tích. Hãy thử lại sau.',
    riskLevel: 'Mức độ rủi ro',
    confidence: 'Độ tin cậy',
    severityPrefix: 'Mức độ nghiêm trọng:',
    urgencyPrefix: 'Mức khẩn cấp:',
    legitimacyPrefix: 'Tính hợp pháp:',
    suggestedNextSteps: 'Các bước tiếp theo đề xuất',
    helpfulResources: 'Tài nguyên hữu ích',
    noLinkedResources: 'Không có tài nguyên được liên kết.',
    sectionTitle: 'Phân tích an toàn',
    analysisFailedGeneric:
      'Không thể hoàn tất phân tích an toàn. Vui lòng thử lại sau.',
    documentLoadFailed:
      'Chúng tôi không thể tải tài liệu. Vui lòng thử lại.',
    noNextSteps:
      'Không có bước tiếp theo cụ thể nào được tạo cho tài liệu này.',
    riskBodyFallback:
      'Đã xác định danh mục rủi ro nhưng không có giải thích.',
  },
}

/** Plain-language copy shown before details when a document is flagged as likely scam. */
export type ScamAckUiStrings = {
  scamAlertTitle: string
  scamAlertLead: string
  scamBulletNoPayment: string
  scamBulletOfficialOnly: string
  scamBulletNoRush: string
  scamAckCheckbox: string
  scamAckButton: string
  /** Shown in the safety card while the scam modal is open (dialog is portaled to the page). */
  scamWaitingHint: string
}

export const SCAM_ACK_UI_STRINGS: Record<SafetyLang, ScamAckUiStrings> = {
  en: {
    scamAlertTitle: 'Likely scam — read this before you act',
    scamAlertLead:
      'Our analysis suggests this document may be fraudulent. Please read every point below. Do not pay, sign, or share sensitive information until you verify independently.',
    scamBulletNoPayment:
      'Do not send money, gift cards, wire transfers, or cryptocurrency based only on this document.',
    scamBulletOfficialOnly:
      'If it claims to be from a bank, government agency, or company, look up their official phone number or website yourself—do not use contact details that appear only here.',
    scamBulletNoRush:
      'Scammers push urgency so you act without thinking. A fake bill or threat often has no real deadline.',
    scamAckCheckbox:
      'I have read the warnings above and understand I must not trust this document without checking through official channels.',
    scamAckButton: 'I understand — show analysis and resources',
    scamWaitingHint:
      'A security alert is open on this page. Complete it to view the full analysis.',
  },
  es: {
    scamAlertTitle: 'Posible estafa — léalo antes de actuar',
    scamAlertLead:
      'Nuestro análisis sugiere que este documento podría ser fraudulento. Lea cada punto. No pague, firme ni comparta datos sensibles hasta verificarlo por su cuenta.',
    scamBulletNoPayment:
      'No envíe dinero, tarjetas regalo, transferencias ni criptomonedas solo por este documento.',
    scamBulletOfficialOnly:
      'Si dice ser de un banco, organismo o empresa, busque usted mismo el teléfono o la web oficial—no use los datos de contacto que solo aparecen aquí.',
    scamBulletNoRush:
      'Las estafas apelan a la urgencia. Una factura o amenaza falsa suele no tener un plazo real.',
    scamAckCheckbox:
      'He leído las advertencias y entiendo que no debo confiar en este documento sin comprobarlo por canales oficiales.',
    scamAckButton: 'Entiendo — mostrar análisis y recursos',
    scamWaitingHint:
      'Hay una alerta de seguridad abierta. Complétela para ver el análisis completo.',
  },
  fr: {
    scamAlertTitle: 'Probable arnaque — lisez ceci avant d’agir',
    scamAlertLead:
      'Notre analyse indique que ce document est peut-être frauduleux. Lisez chaque point. Ne payez, ne signez et ne partagez pas d’informations sensibles avant une vérification indépendante.',
    scamBulletNoPayment:
      'N’envoyez pas d’argent, cartes-cadeaux, virements ni cryptomonnaie sur la seule base de ce document.',
    scamBulletOfficialOnly:
      'S’il prétend provenir d’une banque, administration ou entreprise, retrouvez vous-même le numéro ou le site officiel—pas les coordonnées indiquées uniquement ici.',
    scamBulletNoRush:
      'Les arnaques créent de l’urgence. Une fausse facture ou menace n’a souvent aucune échéance réelle.',
    scamAckCheckbox:
      'J’ai lu les avertissements et je comprends que je ne dois pas me fier à ce document sans vérification officielle.',
    scamAckButton: 'J’ai compris — afficher l’analyse et les ressources',
    scamWaitingHint:
      'Une alerte de sécurité est ouverte. Complétez-la pour voir l’analyse complète.',
  },
  de: {
    scamAlertTitle: 'Wahrscheinlich Betrug — bitte zuerst lesen',
    scamAlertLead:
      'Unsere Analyse deutet darauf hin, dass dieses Dokument betrügerisch sein könnte. Lesen Sie jeden Punkt. Zahlen, unterschreiben oder sensible Daten nicht weitergeben, bis Sie selbst geprüft haben.',
    scamBulletNoPayment:
      'Senden Sie kein Geld, keine Geschenkkarten, Überweisungen oder Kryptowährung allein aufgrund dieses Dokuments.',
    scamBulletOfficialOnly:
      'Behauptet es, von einer Bank, Behörde oder Firma zu stammen, suchen Sie selbst die offizielle Telefonnummer oder Website—nicht nur die hier genannten Kontaktdaten.',
    scamBulletNoRush:
      'Betrüger erzeugen Zeitdruck. Eine gefälschte Rechnung oder Drohung hat oft keine echte Frist.',
    scamAckCheckbox:
      'Ich habe die Hinweise gelesen und verstehe, dass ich diesem Dokument nicht vertrauen darf, ohne offiziell nachzuprüfen.',
    scamAckButton: 'Verstanden — Analyse und Hilfsangebote anzeigen',
    scamWaitingHint:
      'Ein Sicherheitshinweis ist geöffnet. Schließen Sie ihn ab, um die vollständige Analyse zu sehen.',
  },
  zh: {
    scamAlertTitle: '可能是诈骗 — 请先阅读再行动',
    scamAlertLead:
      '分析显示此文件可能具有欺诈性。请读完下列每一点。在自行核实之前，请勿付款、签字或提供敏感信息。',
    scamBulletNoPayment: '请勿仅依据此文件汇款、购买礼品卡、转账或支付加密货币。',
    scamBulletOfficialOnly:
      '若声称来自银行、政府机构或公司，请自行查找官方电话或网站—不要使用仅出现在此处的联系方式。',
    scamBulletNoRush: '诈骗常制造紧迫感。虚假账单或威胁往往没有真正的截止日期。',
    scamAckCheckbox:
      '我已阅读上述警告，并理解在未通过官方渠道核实前不应轻信此文件。',
    scamAckButton: '我已了解 — 显示分析与资源',
    scamWaitingHint: '安全提示窗口已打开。请先完成操作后再查看完整分析。',
  },
  'zh-TW': {
    scamAlertTitle: '可能是詐騙 — 請先閱讀再行動',
    scamAlertLead:
      '分析顯示此文件可能具有欺詐性。請讀完下列每一點。在自行查證前，請勿付款、簽署或提供敏感資訊。',
    scamBulletNoPayment: '請勿僅依此文件匯款、購買禮品卡、轉帳或支付加密貨幣。',
    scamBulletOfficialOnly:
      '若聲稱來自銀行、政府機關或公司，請自行查找官方電話或網站—不要使用僅出現在此的聯絡方式。',
    scamBulletNoRush: '詐騙常製造緊迫感。虛假帳單或威脅往往沒有真正的截止期限。',
    scamAckCheckbox:
      '我已閱讀上述警告，並理解在未經官方管道查證前不應輕信此文件。',
    scamAckButton: '我已了解 — 顯示分析與資源',
    scamWaitingHint: '安全性提示視窗已開啟。請先完成後再查看完整分析。',
  },
  ja: {
    scamAlertTitle: '詐欺の可能性があります — 行動前に必ずお読みください',
    scamAlertLead:
      '分析の結果、この書類は詐欺である可能性があります。以下をすべてお読みください。ご自身で確認するまで、支払い・署名・個人情報の提供はしないでください。',
    scamBulletNoPayment:
      'この書類だけを理由に、現金・ギフトカード・送金・暗号資産を送らないでください。',
    scamBulletOfficialOnly:
      '銀行・官公庁・企業を名乗る場合は、ご自身で公式の電話番号やサイトを調べてください。この書類にしか載っていない連絡先は使わないでください。',
    scamBulletNoRush:
      '詐欺は緊急性をあおります。偽の請求や脅しに、本物の期限はないことが多いです。',
    scamAckCheckbox:
      '上記の警告を読み、公式の経路で確認するまでこの書類を信じてはならないことを理解しました。',
    scamAckButton: '理解しました — 分析と情報を表示',
    scamWaitingHint:
      'セキュリティに関する通知が開いています。完了すると詳しい分析を表示できます。',
  },
  ko: {
    scamAlertTitle: '사기 가능성이 있습니다 — 조치 전에 읽어 주세요',
    scamAlertLead:
      '분석 결과 이 문서는 사기일 수 있습니다. 아래 내용을 모두 읽어 주세요. 직접 확인하기 전에는 결제·서명·민감 정보 제공을 하지 마세요.',
    scamBulletNoPayment:
      '이 문서만 보고 송금, 기프트 카드, 암호화폐 등을 보내지 마세요.',
    scamBulletOfficialOnly:
      '은행·정부 기관·회사를 사칭한다면 공식 전화번호나 웹사이트를 직접 찾으세요. 이 문서에만 적힌 연락처는 사용하지 마세요.',
    scamBulletNoRush:
      '사기꾼은 급하게 행동하라고 합니다. 가진 청구나 협박에는 실제 마감이 없는 경우가 많습니다.',
    scamAckCheckbox:
      '위 경고를 읽었으며 공식 경로로 확인하기 전에는 이 문서를 믿지 않겠습니다.',
    scamAckButton: '이해했습니다 — 분석 및 자료 표시',
    scamWaitingHint:
      '보안 알림 창이 열려 있습니다. 완료한 뒤 전체 분석을 볼 수 있습니다.',
  },
  pt: {
    scamAlertTitle: 'Provável fraude — leia antes de agir',
    scamAlertLead:
      'A nossa análise sugere que este documento pode ser fraudulento. Leia cada ponto. Não pague, assine nem partilhe dados sensíveis até verificar por si.',
    scamBulletNoPayment:
      'Não envie dinheiro, cartões-presente, transferências ou criptomoedas só com base neste documento.',
    scamBulletOfficialOnly:
      'Se alegar ser de um banco, serviço público ou empresa, procure o telefone ou site oficial—não use contactos que apareçam apenas aqui.',
    scamBulletNoRush:
      'Os fraudadores criam urgência. Uma fatura ou ameaça falsa muitas vezes não tem prazo real.',
    scamAckCheckbox:
      'Li os avisos e compreendo que não devo confiar neste documento sem verificação oficial.',
    scamAckButton: 'Compreendo — mostrar análise e recursos',
    scamWaitingHint:
      'Há um alerta de segurança aberto. Conclua-o para ver a análise completa.',
  },
  it: {
    scamAlertTitle: 'Probabile truffa — leggere prima di agire',
    scamAlertLead:
      'La nostra analisi indica che questo documento potrebbe essere fraudulento. Legga ogni punto. Non paghi, firmi né condivida dati sensibili finché non verifica in modo indipendente.',
    scamBulletNoPayment:
      'Non invii denaro, gift card, bonifici o criptovalute solo sulla base di questo documento.',
    scamBulletOfficialOnly:
      'Se dichiara di provenire da una banca, ente o azienda, cerchi lei il numero o il sito ufficiale—non usi i recapiti riportati solo qui.',
    scamBulletNoRush:
      'Le truffe creano urgenza. Una falsa richiesta di pagamento o minaccia spesso non ha una scadenza reale.',
    scamAckCheckbox:
      'Ho letto gli avvisi e capisco di non dover fidarmi di questo documento senza verifica ufficiale.',
    scamAckButton: 'Ho capito — mostra analisi e risorse',
    scamWaitingHint:
      'È aperto un avviso di sicurezza. Completalo per vedere l’analisi completa.',
  },
  ru: {
    scamAlertTitle: 'Вероятное мошенничество — прочитайте перед действиями',
    scamAlertLead:
      'Анализ показывает: документ может быть мошенническим. Прочитайте каждый пункт. Не платите, не подписывайте и не передавайте конфиденциональные данные, пока не проверите самостоятельно.',
    scamBulletNoPayment:
      'Не переводите деньги, не покупайте подарочные карты и криптовалюту только из‑за этого документа.',
    scamBulletOfficialOnly:
      'Если указано имя банка, ведомства или компании, найдите официальный телефон или сайт сами — не используйте контакты, которые есть только здесь.',
    scamBulletNoRush:
      'Мошенники давят срочностью. У поддельного счета или угрозы часто нет реального срока.',
    scamAckCheckbox:
      'Я прочитал(а) предупреждения и понимаю, что нельзя доверять документу без проверки через официальные каналы.',
    scamAckButton: 'Понимаю — показать анализ и ресурсы',
    scamWaitingHint:
      'Открыто предупреждение безопасности. Завершите его, чтобы увидеть полный анализ.',
  },
  ar: {
    scamAlertTitle: 'احتمال احتيال — اقرأ هذا قبل أن تتصرف',
    scamAlertLead:
      'يشير تحليلنا إلى أن هذا المستند قد يكون احتياليًا. اقرأ كل نقطة. لا تدفع ولا توقّع ولا تشارك معلومات حسّاسة حتى تتحقق بنفسك.',
    scamBulletNoPayment:
      'لا ترسل أموالًا أو بطاقات هدايا أو تحويلات أو عملات مشفّرة اعتمادًا على هذا المستند فقط.',
    scamBulletOfficialOnly:
      'إذا زعم أنه من بنك أو جهة حكومية أو شركة، فابحث عن رقم أو موقع رسمي بنفسك—ولا تستخدم بيانات التواصل الموجودة هنا فقط.',
    scamBulletNoRush:
      'المحتالون يخلقون استعجالًا. غالبًا لا يوجد موعد نهائي حقيقي لتهديد أو فاتورة مزيّفة.',
    scamAckCheckbox:
      'لقد قرأت التحذيرات وأفهم أنني لا يجب أن أثق بهذا المستند دون التحقق عبر القنوات الرسمية.',
    scamAckButton: 'أفهم — عرض التحليل والموارد',
    scamWaitingHint:
      'تنبيه أمان مفتوح. أكمله لعرض التحليل الكامل.',
  },
  hi: {
    scamAlertTitle: 'संभावित घोटाला — कार्रवाई से पहले पढ़ें',
    scamAlertLead:
      'हमारा विश्लेषण बताता है कि यह दस्तावेज़ धोखाधड़ी वाला हो सकता है। हर बिंदु पढ़ें। स्वतंत्र रूप से जाँच किए बिना भुगतान, हस्ताक्षर या संवेदनशील जानकारी साझा न करें।',
    scamBulletNoPayment:
      'केवल इस दस्तावेज़ के आधार पर पैसा, गिफ्ट कार्ड, ट्रांसफ़र या क्रिप्टो न भेजें।',
    scamBulletOfficialOnly:
      'यदि बैंक, सरकारी विभाग या कंपनी का दावा है, तो खुद आधिकारिक फोन या वेबसाइट खोजें—केवल यहाँ दिए गए संपर्क का उपयोग न करें।',
    scamBulletNoRush:
      'ठग तुरंत कार्रवाई का दबाव डालते हैं। नकली बिल या धमकी में अक्सर कोई असली समयसीमा नहीं होती।',
    scamAckCheckbox:
      'मैने चेतावनियाँ पढ़ ली हैं और समझता/समझती हूँ कि आधिकारिक जाँच के बिना इस दस्तावेज़ पर भरोसा नहीं करना चाहिए।',
    scamAckButton: 'समझ गया — विश्लेषण और संसाधन दिखाएँ',
    scamWaitingHint:
      'एक सुरक्षा चेतावनी खुली है। पूरा विश्लेषण देखने के लिए इसे पूरा करें।',
  },
  nl: {
    scamAlertTitle: 'Waarschijnlijk oplichting — lees dit eerst',
    scamAlertLead:
      'Onze analyse suggereert dat dit document frauduleus kan zijn. Lees elk punt. Betaal, teken of deel geen gevoelige gegevens tot u zelf heeft gecontroleerd.',
    scamBulletNoPayment:
      'Stuur geen geld, cadeaukaarten, overschrijvingen of crypto alleen op basis van dit document.',
    scamBulletOfficialOnly:
      'Als het zich voordoet als bank, overheidsinstantie of bedrijf, zoek zelf het officiële nummer of de website—gebruik geen contactgegevens die alleen hier staan.',
    scamBulletNoRush:
      'Oplichters creëren urgentie. Een nepfactuur of dreigement heeft vaak geen echte deadline.',
    scamAckCheckbox:
      'Ik heb de waarschuwingen gelezen en begrijp dat ik dit document niet zonder officiële verificatie moet vertrouwen.',
    scamAckButton: 'Ik begrijp het — toon analyse en hulpbronnen',
    scamWaitingHint:
      'Er is een beveiligingsmelding open. Voltooi deze om de volledige analyse te zien.',
  },
  pl: {
    scamAlertTitle: 'Prawdopodobne oszustwo — przeczytaj przed działaniem',
    scamAlertLead:
      'Nasza analiza wskazuje, że dokument może być fałszywy. Przeczytaj każdy punkt. Nie płać, nie podpisuj ani nie udostępniaj wrażliwych danych, dopóki samodzielnie tego nie zweryfikujesz.',
    scamBulletNoPayment:
      'Nie wysyłaj pieniędzy, kart podarunkowych, przelewów ani kryptowalut wyłącznie na podstawie tego dokumentu.',
    scamBulletOfficialOnly:
      'Jeśli podaje się za bank, urząd lub firmę, sam znajdź oficjalny numer lub stronę—nie używaj danych kontaktowych podanych tylko tutaj.',
    scamBulletNoRush:
      'Oszuści wywołują pośpiech. Fałszywy rachunek lub groźba często nie mają realnego terminu.',
    scamAckCheckbox:
      'Przeczytałem/am ostrzeżenia i rozumiem, że nie mogę ufać temu dokumentowi bez weryfikacji urzędowej.',
    scamAckButton: 'Rozumiem — pokaż analizę i zasoby',
    scamWaitingHint:
      'Otwarto alert bezpieczeństwa. Dokończ go, aby zobaczyć pełną analizę.',
  },
  sv: {
    scamAlertTitle: 'Troligen bedrägeri — läs detta först',
    scamAlertLead:
      'Vår analys tyder på att dokumentet kan vara bedrägligt. Läs varje punkt. Betala inte, skriv inte under och dela inte känsliga uppgifter förrän du själv har kontrollerat.',
    scamBulletNoPayment:
      'Skicka inte pengar, presentkort, överföringar eller kryptovaluta bara utifrån detta dokument.',
    scamBulletOfficialOnly:
      'Om det utger sig för att komma från en bank, myndighet eller företag, slå själv upp officiellt nummer eller webbplats—anv inte kontaktuppgifter som bara finns här.',
    scamBulletNoRush:
      'Bedragare skapar brådska. En falsk faktura eller hot har ofta ingen verklig deadline.',
    scamAckCheckbox:
      'Jag har läst varningarna och förstår att jag inte ska lita på dokumentet utan officiell kontroll.',
    scamAckButton: 'Jag förstår — visa analys och resurser',
    scamWaitingHint:
      'En säkerhetsvarning är öppen. Slutför den för att se hela analysen.',
  },
  tr: {
    scamAlertTitle: 'Muhtemel dolandırıcılık — önce bunu okuyun',
    scamAlertLead:
      'Analizimize göre bu belge sahte olabilir. Her maddeyi okuyun. Kendiniz doğrulamadan ödeme yapmayın, imzalamayın veya hassas bilgi paylaşmayın.',
    scamBulletNoPayment:
      'Yalnızca bu belgeye dayanarak para, hediye kartı, havale veya kripto göndermeyin.',
    scamBulletOfficialOnly:
      'Banka, kamu kurumu veya şirket adına olduğunu iddia ediyorsa resmi telefon veya siteyi kendiniz bulun—yalnızca burada yazan iletişimi kullanmayın.',
    scamBulletNoRush:
      'Dolandırıcılar acele ettirir. Sahte fatura veya tehditte çoğu zaman gerçek bir son tarih yoktur.',
    scamAckCheckbox:
      'Uyarıları okudum; resmi kanallardan doğrulama yapmadan bu belgeye güvenmemem gerektiğini anlıyorum.',
    scamAckButton: 'Anladım — analiz ve kaynakları göster',
    scamWaitingHint:
      'Bir güvenlik uyarısı açık. Tam analizi görmek için tamamlayın.',
  },
  vi: {
    scamAlertTitle: 'Có thể là lừa đảo — đọc kỹ trước khi làm gì',
    scamAlertLead:
      'Phân tích cho thấy tài liệu này có thể gian lận. Hãy đọc hết từng ý. Đừng trả tiền, ký tên hay cung cấp thông tin nhạy cảm cho đến khi bạn tự kiểm chứng.',
    scamBulletNoPayment:
      'Không chuyển tiền, thẻ quà, chuyển khoản hay tiền mã hóa chỉ vì tài liệu này.',
    scamBulletOfficialOnly:
      'Nếu tự nhận là ngân hàng, cơ quan nhà nước hay công ty, hãy tự tra số điện thoại hoặc website chính thức—đừng dùng thông tin liên hệ chỉ xuất hiện ở đây.',
    scamBulletNoRush:
      'Lừa đảo thường gây áp lực khẩn cấp. Hóa đơn hoặc đe dọa giả thường không có hạn thực sự.',
    scamAckCheckbox:
      'Tôi đã đọc các cảnh báo và hiểu không được tin tài liệu này nếu chưa xác minh qua kênh chính thức.',
    scamAckButton: 'Tôi đã hiểu — hiển thị phân tích và tài nguyên',
    scamWaitingHint:
      'Cửa sổ cảnh báo bảo mật đang mở. Hoàn tất để xem phân tích đầy đủ.',
  },
}

function severityBlock(
  low: string,
  medium: string,
  high: string,
  urgent: string
): Record<SafetySeverity, string> {
  return { low, medium, high, urgent }
}

export const SAFETY_SEVERITY_LABELS: Record<
  SafetyLang,
  Record<SafetySeverity, string>
> = {
  en: severityBlock(
    'Low urgency',
    'Medium attention',
    'High — review soon',
    'Urgent — act quickly'
  ),
  es: severityBlock(
    'Baja urgencia',
    'Atención media',
    'Alta — revisar pronto',
    'Urgente — actuar con rapidez'
  ),
  fr: severityBlock(
    'Faible urgence',
    'Attention moyenne',
    'Élevé — à revoir bientôt',
    'Urgent — agir rapidement'
  ),
  de: severityBlock(
    'Geringe Dringlichkeit',
    'Mittlere Aufmerksamkeit',
    'Hoch — bald prüfen',
    'Dringend — schnell handeln'
  ),
  zh: severityBlock('低紧迫性', '中等关注', '高 — 尽快查看', '紧急 — 迅速采取行动'),
  'zh-TW': severityBlock(
    '低緊迫性',
    '中度關注',
    '高 — 盡快檢視',
    '緊急 — 迅速採取行動'
  ),
  ja: severityBlock(
    '緊急度：低',
    '注意：中',
    '高 — 早めに確認',
    '緊急 — すぐに対応'
  ),
  ko: severityBlock(
    '낮은 긴급도',
    '보통 주의',
    '높음 — 곧 검토',
    '긴급 — 신속히 조치'
  ),
  pt: severityBlock(
    'Baixa urgência',
    'Atenção média',
    'Alta — rever em breve',
    'Urgente — agir depressa'
  ),
  it: severityBlock(
    'Bassa urgenza',
    'Attenzione media',
    'Alta — rivedere presto',
    'Urgente — agire rapidamente'
  ),
  ru: severityBlock(
    'Низкая срочность',
    'Среднее внимание',
    'Высокая — скоро проверить',
    'Срочно — действовать быстро'
  ),
  ar: severityBlock(
    'إلحاح منخفض',
    'انتباه متوسط',
    'مرتفع — راجع قريبًا',
    'عاجل — تصرّف بسرعة'
  ),
  hi: severityBlock(
    'कम तात्कालिकता',
    'मध्यम ध्यान',
    'उच्च — जल्द समीक्षा करें',
    'तत्काल — शीघ्र कार्रवाई करें'
  ),
  nl: severityBlock(
    'Lage urgentie',
    'Gemiddelde aandacht',
    'Hoog — binnenkort bekijken',
    'Urgent — snel handelen'
  ),
  pl: severityBlock(
    'Niska pilność',
    'Średnia uwaga',
    'Wysokie — wkrótce sprawdź',
    'Pilne — działaj szybko'
  ),
  sv: severityBlock(
    'Låg brådska',
    'Medel uppmärksamhet',
    'Hög — granska snart',
    'Brådskande — agera snabbt'
  ),
  tr: severityBlock(
    'Düşük aciliyet',
    'Orta düzeyde dikkat',
    'Yüksek — yakında gözden geçirin',
    'Acil — hızlıca hareket edin'
  ),
  vi: severityBlock(
    'Mức khẩn cấp thấp',
    'Mức chú ý trung bình',
    'Cao — xem xét sớm',
    'Khẩn cấp — hành động nhanh'
  ),
}

/** Impact / seriousness (not the same as deadline urgency). Used when separating scam seriousness from low time-urgency. */
export const SAFETY_SERIOUSNESS_LABELS: Record<
  SafetyLang,
  Record<SafetySeverity, string>
> = {
  en: severityBlock(
    'Low concern',
    'Moderate concern',
    'High concern',
    'Very high concern'
  ),
  es: severityBlock(
    'Preocupación baja',
    'Preocupación moderada',
    'Preocupación alta',
    'Preocupación muy alta'
  ),
  fr: severityBlock(
    'Faible préoccupation',
    'Préoccupation modérée',
    'Préoccupation élevée',
    'Préoccupation très élevée'
  ),
  de: severityBlock(
    'Geringe Besorgnis',
    'Mittlere Besorgnis',
    'Hohe Besorgnis',
    'Sehr hohe Besorgnis'
  ),
  zh: severityBlock('较低关注', '中等关注', '高度关注', '极高关注'),
  'zh-TW': severityBlock('較低關注', '中度關注', '高度關注', '極高關注'),
  ja: severityBlock(
    '軽い懸念',
    '中程度の懸念',
    '強い懸念',
    '非常に強い懸念'
  ),
  ko: severityBlock(
    '낮은 우려',
    '보통 우려',
    '높은 우려',
    '매우 높은 우려'
  ),
  pt: severityBlock(
    'Baixa preocupação',
    'Preocupação moderada',
    'Alta preocupação',
    'Preocupação muito alta'
  ),
  it: severityBlock(
    'Preoccupazione bassa',
    'Preoccupazione moderata',
    'Preoccupazione alta',
    'Preoccupazione molto alta'
  ),
  ru: severityBlock(
    'Низкая степень обеспокоенности',
    'Умеренная обеспокоенность',
    'Высокая обеспокоенность',
    'Очень высокая обеспокоенность'
  ),
  ar: severityBlock(
    'قلق منخفض',
    'قلق متوسط',
    'قلق مرتفع',
    'قلق مرتفع جدًا'
  ),
  hi: severityBlock(
    'कम चिंता',
    'मध्यम चिंता',
    'अधिक चिंता',
    'बहुत अधिक चिंता'
  ),
  nl: severityBlock(
    'Lage zorg',
    'Gemiddelde zorg',
    'Hoge zorg',
    'Zeer hoge zorg'
  ),
  pl: severityBlock(
    'Niskie zaniepokojenie',
    'Umiarkowane zaniepokojenie',
    'Wysokie zaniepokojenie',
    'Bardzo wysokie zaniepokojenie'
  ),
  sv: severityBlock(
    'Låg oro',
    'Måttlig oro',
    'Hög oro',
    'Mycket hög oro'
  ),
  tr: severityBlock(
    'Düşük endişe',
    'Orta düzeyde endişe',
    'Yüksek endişe',
    'Çok yüksek endişe'
  ),
  vi: severityBlock(
    'Mức lo ngại thấp',
    'Mức lo ngại trung bình',
    'Mức lo ngại cao',
    'Mức lo ngại rất cao'
  ),
}

function legitimacyBlock(
  likelyLegitimate: string,
  uncertain: string,
  likelyScam: string
): Record<SafetyLegitimacy, string> {
  return {
    likely_legitimate: likelyLegitimate,
    uncertain,
    likely_scam: likelyScam,
  }
}

export const SAFETY_LEGITIMACY_LABELS: Record<
  SafetyLang,
  Record<SafetyLegitimacy, string>
> = {
  en: legitimacyBlock(
    'Likely legitimate',
    'Uncertain',
    'Likely scam'
  ),
  es: legitimacyBlock(
    'Probablemente legítimo',
    'Incerto',
    'Probable estafa'
  ),
  fr: legitimacyBlock(
    'Probablement légitime',
    'Incertain',
    'Probable arnaque'
  ),
  de: legitimacyBlock(
    'Wahrscheinlich legitim',
    'Unsicher',
    'Wahrscheinlich Betrug'
  ),
  zh: legitimacyBlock('可能正当', '不确定', '可能诈骗'),
  'zh-TW': legitimacyBlock('可能正当', '不確定', '可能詐騙'),
  ja: legitimacyBlock(
    'おそらく正当',
    '不明',
    'おそらく詐欺'
  ),
  ko: legitimacyBlock(
    '아마도 정당함',
    '불확실',
    '아마도 사기'
  ),
  pt: legitimacyBlock(
    'Provavelmente legítimo',
    'Incerto',
    'Provável fraude'
  ),
  it: legitimacyBlock(
    'Probabilmente legittimo',
    'Incerto',
    'Probabile truffa'
  ),
  ru: legitimacyBlock(
    'Вероятно законно',
    'Неопределённо',
    'Вероятно мошенничество'
  ),
  ar: legitimacyBlock(
    'على الأرجح شرعي',
    'غير مؤكد',
    'على الأرجح احتيال'
  ),
  hi: legitimacyBlock(
    'संभवतः वैध',
    'अनिश्चित',
    'संभवतः धोखाधड़ी'
  ),
  nl: legitimacyBlock(
    'Waarschijnlijk legitiem',
    'Onzeker',
    'Waarschijnlijk oplichting'
  ),
  pl: legitimacyBlock(
    'Prawdopodobnie legalne',
    'Niepewne',
    'Prawdopodobnie oszustwo'
  ),
  sv: legitimacyBlock(
    'Troligen legitim',
    'Osäker',
    'Troligen bedrägeri'
  ),
  tr: legitimacyBlock(
    'Muhtemelen meşru',
    'Belirsiz',
    'Muhtemelen dolandırıcılık'
  ),
  vi: legitimacyBlock(
    'Có thể hợp pháp',
    'Không chắc chắn',
    'Có thể là lừa đảo'
  ),
}

export const SAFETY_DISCLAIMER: Record<SafetyLang, string> = {
  en: 'This information is for education only. It is not legal, medical, or financial advice.',
  es: 'Esta información es solo educativa. No constituye asesoramiento legal, médico ni financiero.',
  fr: "Ces informations sont à titre éducatif uniquement. Ce n'est pas un conseil juridique, médical ou financier.",
  de: 'Diese Informationen dienen nur der Aufklärung. Sie stellen keine Rechts-, Medizin- oder Finanzberatung dar.',
  zh: '本信息仅供教育用途，不构成法律、医疗或财务建议。',
  'zh-TW': '本資訊僅供教育用途，不構成法律、醫療或財務建議。',
  ja: 'この情報は教育目的のみです。法的・医療的・金融的な助言ではありません。',
  ko: '이 정보는 교육 목적으로만 제공됩니다. 법률·의료·재무 조언이 아닙니다.',
  pt: 'Esta informação é apenas para fins educativos. Não constitui aconselhamento jurídico, médico ou financeiro.',
  it: 'Queste informazioni sono solo a scopo educativo. Non costituiscono consulenza legale, medica o finanziaria.',
  ru: 'Эта информация носит исключительно образовательный характер. Это не юридическая, медицинская или финансовая консультация.',
  ar: 'هذه المعلومات لأغراض تعليمية فقط. وليست استشارة قانونية أو طبية أو مالية.',
  hi: 'यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है। यह कानूनी, चिकित्सा या वित्तीय सलाह नहीं है।',
  nl: 'Deze informatie is uitsluitend voor educatieve doeleinden. Het is geen juridisch, medisch of financieel advies.',
  pl: 'Te informacje mają wyłącznie charakter edukacyjny. Nie stanowią porady prawnej, medycznej ani finansowej.',
  sv: 'Denna information är endast för utbildning. Det är inte juridisk, medicinsk eller finansiell rådgivning.',
  tr: 'Bu bilgi yalnızca eğitim amaçlıdır. Hukuki, tıbbi veya mali tavsiye değildir.',
  vi: 'Thông tin này chỉ mang mục đích giáo dục. Đây không phải là tư vấn pháp lý, y tế hay tài chính.',
}
