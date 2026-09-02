import { z } from "zod";

export const SupportedLocaleSchema = z.enum([
  "en-US",
  "es-ES",
  "fr-FR",
  "de-DE",
  "ja-JP"
]);

export const SUPPORTED_LOCALES = SupportedLocaleSchema.options;
export const LOCALIZATION_CATALOG_VERSION = "2026.07.29.1";

export type SupportedLocale = z.infer<typeof SupportedLocaleSchema>;

export const PRODUCT_SHELL_SOURCE_TEXT = [
  "Admin",
  "Agent Swarm",
  "Agent Workflows",
  "AI Apps",
  "Attack Paths",
  "Autonomous",
  "Clients",
  "Compliance",
  "Connect",
  "Controls",
  "Dashboard",
  "Engagements",
  "Engines",
  "Evidence",
  "Executive",
  "External Validation",
  "Findings",
  "Govern",
  "Home",
  "Integrations",
  "Intel",
  "Investigate",
  "Jump to a page…",
  "Labs",
  "Machine Identities",
  "MCP Server",
  "Model Gateway",
  "New validation",
  "Operate",
  "Operators",
  "Paths",
  "Policies",
  "Prove",
  "Proof-loop Packs",
  "Remediate",
  "Remediation",
  "Reports",
  "Runners",
  "Schedule",
  "Schedules",
  "Setup",
  "Signal Activity",
  "Tenant & access",
  "Threat Center",
  "Threat Feed",
  "Tool Governance",
  "Validate",
  "Validation Ops",
  "Validation Snapshot"
] as const;

export type ProductShellSourceText = (typeof PRODUCT_SHELL_SOURCE_TEXT)[number];

const ENGLISH_PRODUCT_SHELL = Object.fromEntries(
  PRODUCT_SHELL_SOURCE_TEXT.map((value) => [value, value])
) as Record<ProductShellSourceText, string>;

export const PRODUCT_SHELL_TRANSLATIONS: Record<
  SupportedLocale,
  Record<ProductShellSourceText, string>
> = {
  "de-DE": {
    Admin: "Verwaltung",
    "Agent Swarm": "Agenten-Schwarm",
    "Agent Workflows": "Agenten-Workflows",
    "AI Apps": "KI-Anwendungen",
    "Attack Paths": "Angriffspfade",
    Autonomous: "Autonom",
    Clients: "Kunden",
    Compliance: "Compliance",
    Connect: "Verbinden",
    Controls: "Kontrollen",
    Dashboard: "Übersicht",
    Engagements: "Validierungsaufträge",
    Engines: "Engines",
    Evidence: "Nachweise",
    Executive: "Management",
    "External Validation": "Externe Validierung",
    Findings: "Befunde",
    Govern: "Steuern",
    Home: "Start",
    Integrations: "Integrationen",
    Intel: "Bedrohungen",
    Investigate: "Untersuchen",
    "Jump to a page…": "Seite öffnen…",
    Labs: "Labs",
    "Machine Identities": "Maschinenidentitäten",
    "MCP Server": "MCP-Server",
    "Model Gateway": "Modell-Gateway",
    "New validation": "Neue Validierung",
    Operate: "Betreiben",
    Operators: "Operatoren",
    Paths: "Pfade",
    Policies: "Richtlinien",
    Prove: "Nachweisen",
    "Proof-loop Packs": "Proof-Loop-Pakete",
    Remediate: "Beheben",
    Remediation: "Behebung",
    Reports: "Berichte",
    Runners: "Runner",
    Schedule: "Zeitplan",
    Schedules: "Zeitpläne",
    Setup: "Einrichtung",
    "Signal Activity": "Signalaktivität",
    "Tenant & access": "Mandant & Zugriff",
    "Threat Center": "Bedrohungszentrum",
    "Threat Feed": "Bedrohungsfeed",
    "Tool Governance": "Tool-Steuerung",
    Validate: "Validieren",
    "Validation Ops": "Validierungsbetrieb",
    "Validation Snapshot": "Validierungsübersicht"
  },
  "en-US": ENGLISH_PRODUCT_SHELL,
  "es-ES": {
    Admin: "Administración",
    "Agent Swarm": "Enjambre de agentes",
    "Agent Workflows": "Flujos de agentes",
    "AI Apps": "Aplicaciones de IA",
    "Attack Paths": "Rutas de ataque",
    Autonomous: "Autónomo",
    Clients: "Clientes",
    Compliance: "Cumplimiento",
    Connect: "Conectar",
    Controls: "Controles",
    Dashboard: "Panel",
    Engagements: "Evaluaciones",
    Engines: "Motores",
    Evidence: "Evidencia",
    Executive: "Ejecutivo",
    "External Validation": "Validación externa",
    Findings: "Hallazgos",
    Govern: "Gobernar",
    Home: "Inicio",
    Integrations: "Integraciones",
    Intel: "Inteligencia",
    Investigate: "Investigar",
    "Jump to a page…": "Ir a una página…",
    Labs: "Labs",
    "Machine Identities": "Identidades de máquina",
    "MCP Server": "Servidor MCP",
    "Model Gateway": "Puerta de modelos",
    "New validation": "Nueva validación",
    Operate: "Operar",
    Operators: "Operadores",
    Paths: "Rutas",
    Policies: "Políticas",
    Prove: "Demostrar",
    "Proof-loop Packs": "Paquetes de prueba",
    Remediate: "Remediar",
    Remediation: "Remediación",
    Reports: "Informes",
    Runners: "Ejecutores",
    Schedule: "Programación",
    Schedules: "Programaciones",
    Setup: "Configuración",
    "Signal Activity": "Actividad de señales",
    "Tenant & access": "Espacio y acceso",
    "Threat Center": "Centro de amenazas",
    "Threat Feed": "Canal de amenazas",
    "Tool Governance": "Gobierno de herramientas",
    Validate: "Validar",
    "Validation Ops": "Operaciones de validación",
    "Validation Snapshot": "Instantánea de validación"
  },
  "fr-FR": {
    Admin: "Administration",
    "Agent Swarm": "Essaim d’agents",
    "Agent Workflows": "Flux d’agents",
    "AI Apps": "Applications IA",
    "Attack Paths": "Chemins d’attaque",
    Autonomous: "Autonome",
    Clients: "Clients",
    Compliance: "Conformité",
    Connect: "Connecter",
    Controls: "Contrôles",
    Dashboard: "Tableau de bord",
    Engagements: "Missions",
    Engines: "Moteurs",
    Evidence: "Preuves",
    Executive: "Direction",
    "External Validation": "Validation externe",
    Findings: "Constats",
    Govern: "Gouverner",
    Home: "Accueil",
    Integrations: "Intégrations",
    Intel: "Renseignement",
    Investigate: "Enquêter",
    "Jump to a page…": "Accéder à une page…",
    Labs: "Labs",
    "Machine Identities": "Identités machine",
    "MCP Server": "Serveur MCP",
    "Model Gateway": "Passerelle modèles",
    "New validation": "Nouvelle validation",
    Operate: "Exploiter",
    Operators: "Opérateurs",
    Paths: "Chemins",
    Policies: "Politiques",
    Prove: "Prouver",
    "Proof-loop Packs": "Packs de preuve",
    Remediate: "Corriger",
    Remediation: "Remédiation",
    Reports: "Rapports",
    Runners: "Exécuteurs",
    Schedule: "Planification",
    Schedules: "Planifications",
    Setup: "Configuration",
    "Signal Activity": "Activité des signaux",
    "Tenant & access": "Espace & accès",
    "Threat Center": "Centre des menaces",
    "Threat Feed": "Flux de menaces",
    "Tool Governance": "Gouvernance des outils",
    Validate: "Valider",
    "Validation Ops": "Opérations de validation",
    "Validation Snapshot": "Instantané de validation"
  },
  "ja-JP": {
    Admin: "管理",
    "Agent Swarm": "エージェント群",
    "Agent Workflows": "エージェントワークフロー",
    "AI Apps": "AI アプリ",
    "Attack Paths": "攻撃経路",
    Autonomous: "自律運用",
    Clients: "顧客",
    Compliance: "コンプライアンス",
    Connect: "接続",
    Controls: "コントロール",
    Dashboard: "ダッシュボード",
    Engagements: "検証案件",
    Engines: "エンジン",
    Evidence: "証拠",
    Executive: "経営層",
    "External Validation": "外部検証",
    Findings: "検出事項",
    Govern: "ガバナンス",
    Home: "ホーム",
    Integrations: "連携",
    Intel: "脅威情報",
    Investigate: "調査",
    "Jump to a page…": "ページを開く…",
    Labs: "Labs",
    "Machine Identities": "マシン ID",
    "MCP Server": "MCP サーバー",
    "Model Gateway": "モデルゲートウェイ",
    "New validation": "新しい検証",
    Operate: "運用",
    Operators: "オペレーター",
    Paths: "経路",
    Policies: "ポリシー",
    Prove: "証明",
    "Proof-loop Packs": "証明ループパック",
    Remediate: "修復",
    Remediation: "修復",
    Reports: "レポート",
    Runners: "ランナー",
    Schedule: "スケジュール",
    Schedules: "スケジュール",
    Setup: "セットアップ",
    "Signal Activity": "シグナル活動",
    "Tenant & access": "テナントとアクセス",
    "Threat Center": "脅威センター",
    "Threat Feed": "脅威フィード",
    "Tool Governance": "ツールガバナンス",
    Validate: "検証",
    "Validation Ops": "検証運用",
    "Validation Snapshot": "検証スナップショット"
  }
};

export type ReportTemplateCopy = {
  aiValidation: string;
  connectedIntegrations: string;
  controlVerdicts: string;
  evidenceAppendix: string;
  evidenceBasis: string;
  executiveSummary: string;
  highRiskPaths: string;
  methodology: string;
  noPaths: string;
  remediationPriorities: string;
  remediations: string;
  topPaths: string;
  topRiskBand: string;
  verificationPlan: string;
  verifiedScopes: string;
};

export const REPORT_TEMPLATE_TRANSLATIONS: Record<
  SupportedLocale,
  ReportTemplateCopy
> = {
  "de-DE": {
    aiValidation: "Validierung von KI-Anwendungen",
    connectedIntegrations: "Verbundene Integrationen",
    controlVerdicts: "Kontrollurteile",
    evidenceAppendix: "Nachweisanhang",
    evidenceBasis: "Nachweisgrundlage",
    executiveSummary: "Zusammenfassung",
    highRiskPaths: "Hochriskante Pfade",
    methodology: "Methodik und Sicherheitshinweise",
    noPaths: "Keine priorisierten Angriffspfade verfügbar.",
    remediationPriorities: "Prioritäten der Behebung",
    remediations: "Behebungen",
    topPaths: "Priorisierte Angriffspfade",
    topRiskBand: "Höchste Risikoklasse",
    verificationPlan: "Verifizierungsplan",
    verifiedScopes: "Verifizierte Bereiche"
  },
  "en-US": {
    aiValidation: "AI App Validation",
    connectedIntegrations: "Connected integrations",
    controlVerdicts: "Control Verdicts",
    evidenceAppendix: "Evidence Appendix",
    evidenceBasis: "Evidence basis",
    executiveSummary: "Executive Summary",
    highRiskPaths: "High-risk paths",
    methodology: "Methodology and Safety Notes",
    noPaths: "No priority attack paths were available.",
    remediationPriorities: "Remediation Priorities",
    remediations: "Remediations",
    topPaths: "Priority Attack Paths",
    topRiskBand: "Top risk band",
    verificationPlan: "Verification Plan",
    verifiedScopes: "Verified scopes"
  },
  "es-ES": {
    aiValidation: "Validación de aplicaciones de IA",
    connectedIntegrations: "Integraciones conectadas",
    controlVerdicts: "Resultados de controles",
    evidenceAppendix: "Anexo de evidencia",
    evidenceBasis: "Base de evidencia",
    executiveSummary: "Resumen ejecutivo",
    highRiskPaths: "Rutas de alto riesgo",
    methodology: "Metodología y notas de seguridad",
    noPaths: "No había rutas de ataque prioritarias disponibles.",
    remediationPriorities: "Prioridades de remediación",
    remediations: "Remediaciones",
    topPaths: "Rutas de ataque prioritarias",
    topRiskBand: "Nivel de riesgo principal",
    verificationPlan: "Plan de verificación",
    verifiedScopes: "Ámbitos verificados"
  },
  "fr-FR": {
    aiValidation: "Validation des applications IA",
    connectedIntegrations: "Intégrations connectées",
    controlVerdicts: "Verdicts des contrôles",
    evidenceAppendix: "Annexe des preuves",
    evidenceBasis: "Base de preuve",
    executiveSummary: "Synthèse",
    highRiskPaths: "Chemins à haut risque",
    methodology: "Méthodologie et notes de sécurité",
    noPaths: "Aucun chemin d’attaque prioritaire n’était disponible.",
    remediationPriorities: "Priorités de remédiation",
    remediations: "Remédiations",
    topPaths: "Chemins d’attaque prioritaires",
    topRiskBand: "Niveau de risque principal",
    verificationPlan: "Plan de vérification",
    verifiedScopes: "Périmètres vérifiés"
  },
  "ja-JP": {
    aiValidation: "AI アプリ検証",
    connectedIntegrations: "接続済み連携",
    controlVerdicts: "コントロール判定",
    evidenceAppendix: "証拠付録",
    evidenceBasis: "証拠根拠",
    executiveSummary: "エグゼクティブサマリー",
    highRiskPaths: "高リスク経路",
    methodology: "方法論と安全上の注意",
    noPaths: "優先攻撃経路はありません。",
    remediationPriorities: "修復の優先順位",
    remediations: "修復",
    topPaths: "優先攻撃経路",
    topRiskBand: "最高リスク帯",
    verificationPlan: "検証計画",
    verifiedScopes: "検証済みスコープ"
  }
};

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "de-DE": "Deutsch (Deutschland)",
  "en-US": "English (United States)",
  "es-ES": "Español (España)",
  "fr-FR": "Français (France)",
  "ja-JP": "日本語 (日本)"
};

export function translateProductShellText(
  locale: SupportedLocale,
  value: string
) {
  return PRODUCT_SHELL_SOURCE_TEXT.includes(value as ProductShellSourceText)
    ? PRODUCT_SHELL_TRANSLATIONS[locale][value as ProductShellSourceText]
    : value;
}

export function getReportTemplateCopy(locale: SupportedLocale) {
  return REPORT_TEMPLATE_TRANSLATIONS[locale];
}

export const LocalizationCatalogScopeSchema = z.enum([
  "ProductShell",
  "SnapshotReport"
]);

export const LocalizationCatalogCoverageSchema = z.object({
  complete: z.boolean(),
  completionPercent: z.number().int().min(0).max(100),
  fallbackKeys: z.array(z.string()),
  scope: LocalizationCatalogScopeSchema,
  totalKeys: z.number().int().nonnegative(),
  translatedKeys: z.number().int().nonnegative()
});

export const TenantLocalizationCatalogSchema = z.object({
  catalogDigest: z.string().regex(/^[a-f0-9]{64}$/),
  catalogVersion: z.string().min(1),
  coverage: z.array(LocalizationCatalogCoverageSchema).min(1),
  locale: SupportedLocaleSchema,
  localeLabel: z.string().min(1),
  readyForActivation: z.boolean()
});

export const LocalizationFormatPreviewSchema = z.object({
  dateTime: z.string().min(1),
  locale: SupportedLocaleSchema,
  number: z.string().min(1),
  relativeTime: z.string().min(1),
  sampleNumber: z.number(),
  sampleTimestamp: z.string().datetime(),
  timeZone: z.string().min(1)
});

export const TenantLocalizationReleaseSchema = z.object({
  activatedAt: z.string().datetime(),
  activatedBy: z.string().uuid(),
  catalogDigest: z.string().regex(/^[a-f0-9]{64}$/),
  catalogVersion: z.string().min(1),
  coverage: z.array(LocalizationCatalogCoverageSchema).min(1),
  locale: SupportedLocaleSchema,
  localizationReleaseId: z.string().uuid(),
  previousLocale: SupportedLocaleSchema,
  previousTimeZone: z.string().min(1),
  reviewReason: z.string().min(10),
  reviewReference: z.string().min(3),
  sequence: z.number().int().positive(),
  supportOwnerEmail: z.string().email(),
  tenantId: z.string().uuid(),
  timeZone: z.string().min(1)
});

export const TenantLocalizationSchema = z.object({
  activeReleaseId: z.string().uuid().nullable(),
  catalogCoverage: z.array(LocalizationCatalogCoverageSchema).min(1),
  catalogDigest: z.string().regex(/^[a-f0-9]{64}$/),
  catalogVersion: z.string().min(1),
  evidenceIdentifiersLocalized: z.literal(false),
  preferredLocale: SupportedLocaleSchema,
  preferredTimeZone: z.string().min(1),
  reportClaimSemanticsLocalized: z.literal(false),
  reviewReference: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  supportOwnerEmail: z.string().email().nullable(),
  supportedLocales: z.array(SupportedLocaleSchema)
});

export const TenantLocalizationWorkspaceSchema = z.object({
  catalogs: z.array(TenantLocalizationCatalogSchema).min(1),
  contentBoundary: z.string().min(1),
  dataRegion: z.string().min(1),
  formatPreview: LocalizationFormatPreviewSchema,
  generatedAt: z.string().datetime(),
  localization: TenantLocalizationSchema,
  releaseHistory: z.array(TenantLocalizationReleaseSchema),
  residencyBoundary: z.string().min(1)
});

export const UpdateTenantLocalizationInputSchema = z
  .object({
    preferredLocale: SupportedLocaleSchema,
    reviewReason: z.string().trim().min(10).max(1000),
    reviewReference: z.string().trim().min(3).max(120),
    supportOwnerEmail: z.string().trim().email(),
    timeZone: z.string().trim().min(1).max(80)
  })
  .strict();

export const PreviewTenantLocalizationInputSchema = z
  .object({
    locale: SupportedLocaleSchema,
    sampleNumber: z.number().finite().default(1234567.89),
    sampleTimestamp: z.string().datetime().optional(),
    timeZone: z.string().trim().min(1).max(80)
  })
  .strict();

export type LocalizationCatalogCoverage = z.infer<
  typeof LocalizationCatalogCoverageSchema
>;
export type LocalizationFormatPreview = z.infer<
  typeof LocalizationFormatPreviewSchema
>;
export type PreviewTenantLocalizationInput = z.input<
  typeof PreviewTenantLocalizationInputSchema
>;
export type TenantLocalization = z.infer<typeof TenantLocalizationSchema>;
export type TenantLocalizationCatalog = z.infer<
  typeof TenantLocalizationCatalogSchema
>;
export type TenantLocalizationRelease = z.infer<
  typeof TenantLocalizationReleaseSchema
>;
export type TenantLocalizationWorkspace = z.infer<
  typeof TenantLocalizationWorkspaceSchema
>;
export type UpdateTenantLocalizationInput = z.input<
  typeof UpdateTenantLocalizationInputSchema
>;
