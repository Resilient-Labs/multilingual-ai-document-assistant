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
