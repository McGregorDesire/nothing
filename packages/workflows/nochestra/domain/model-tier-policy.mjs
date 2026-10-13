const OLLAMA_ORNITH = { provider: "ollama", name: "ornith:9b", contextWindow: 262144 };

const GEMINI_38_FLASH = { provider: "antigravity", name: "gemini-3.8-flash", contextWindow: 1048576 };
const GEMINI_35_FLASH = { provider: "antigravity", name: "gemini-3.5-flash", contextWindow: 1048576 };
const GEMINI_31_PRO = { provider: "antigravity", name: "gemini-3.1-pro", contextWindow: 1048576 };
const CLAUDE_SONNET = { provider: "antigravity", name: "claude-sonnet-5-5", contextWindow: 250000 };
const CLAUDE_OPUS = { provider: "antigravity", name: "claude-opus-5-5", contextWindow: 250000 };
const GPT_OSS = { provider: "antigravity", name: "gpt-oss-120b", contextWindow: 131072 };

const GPT_54 = { provider: "openai-codex", name: "gpt-5.4", contextWindow: 272000 };
const GPT_54_MINI = { provider: "openai-codex", name: "gpt-5.4-mini", contextWindow: 272000 };

export const AVAILABLE_MODEL_TIERS = Object.freeze({
	ollama: [
		OLLAMA_ORNITH,
	],
	antigravity: [
		GEMINI_38_FLASH,
		GEMINI_35_FLASH,
		GEMINI_31_PRO,
		CLAUDE_SONNET,
		CLAUDE_OPUS,
		GPT_OSS,
	],
	"openai-codex": [
		GPT_54,
		GPT_54_MINI,
	],
});

export const DEFAULT_LOCAL_TIER = Object.freeze(OLLAMA_ORNITH);
export const DEFAULT_CLOUD_TIER = Object.freeze(GEMINI_38_FLASH);

const MODEL_ALIASES = new Map();
for (const models of Object.values(AVAILABLE_MODEL_TIERS)) {
	for (const m of models) {
		MODEL_ALIASES.set(m.name.toLowerCase(), m);
		const compact = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
		if (!MODEL_ALIASES.has(compact)) {
			MODEL_ALIASES.set(compact, m);
		}
	}
}

// Typo and shortcut alias mappings
const TYPO_ALIASES = [
	["ornith", OLLAMA_ORNITH],
	["ornith9", OLLAMA_ORNITH],
	["ornith-9b", OLLAMA_ORNITH],
	["3.8flash", GEMINI_38_FLASH],
	["3.8-flash", GEMINI_38_FLASH],
	["38flash", GEMINI_38_FLASH],
	["3.8.flash", GEMINI_38_FLASH],
	["sonnet", CLAUDE_SONNET],
	["opus", CLAUDE_OPUS],
	["sonnet55", CLAUDE_SONNET],
	["opus55", CLAUDE_OPUS],
	["gpt54", GPT_54],
	["gpt54m", GPT_54_MINI],
	["gpt54mini", GPT_54_MINI],
];

for (const [alias, model] of TYPO_ALIASES) {
	if (!MODEL_ALIASES.has(alias)) {
		MODEL_ALIASES.set(alias, model);
	}
}

const PROVIDER_ALIASES = new Map([
	["openai", "openai-codex"],
	["codex", "openai-codex"],
	["gemini", "antigravity"],
	["google", "antigravity"],
]);

export function resolveModelOverride(overrideSpec) {
	if (!overrideSpec || typeof overrideSpec !== "string") return null;
	const spec = overrideSpec.trim().toLowerCase();
	if (spec.includes("/")) {
		let [provider, ...rest] = spec.split("/");
		const name = rest.join("/");
		provider = PROVIDER_ALIASES.get(provider) || provider;
		const known = MODEL_ALIASES.get(name) || MODEL_ALIASES.get(name.replace(/[^a-z0-9]/g, ""));
		return {
			provider,
			name,
			contextWindow: known?.contextWindow || 128000,
		};
	}
	const direct = MODEL_ALIASES.get(spec);
	if (direct) return direct;
	const compactSpec = spec.replace(/[^a-z0-9]/g, "");
	const compactDirect = MODEL_ALIASES.get(compactSpec);
	if (compactDirect) return compactDirect;
	for (const [alias, provider] of PROVIDER_ALIASES) {
		if (spec.startsWith(`${alias} `)) {
			const name = spec.slice(alias.length).trim();
			const known = MODEL_ALIASES.get(name) || MODEL_ALIASES.get(name.replace(/[^a-z0-9]/g, ""));
			if (known) return known;
			return { provider, name, contextWindow: 128000 };
		}
	}
	return null;
}

const LIGHTWEIGHT_DESTINATIONS = new Set(["triage", "frame", "note"]);

export function resolveModelTier(destination, options = {}) {
	const env = options.env || process.env;
	const localModel = {
		provider: env.NOCH_LOCAL_PROVIDER || DEFAULT_LOCAL_TIER.provider,
		name: env.NOCH_LOCAL_MODEL || DEFAULT_LOCAL_TIER.name,
		contextWindow: Number(env.NOCH_LOCAL_CONTEXT_WINDOW) || DEFAULT_LOCAL_TIER.contextWindow,
	};
	const cloudModel = {
		provider: env.NOCH_CLOUD_PROVIDER || DEFAULT_CLOUD_TIER.provider,
		name: env.NOCH_CLOUD_MODEL || DEFAULT_CLOUD_TIER.name,
		contextWindow: Number(env.NOCH_CLOUD_CONTEXT_WINDOW) || DEFAULT_CLOUD_TIER.contextWindow,
	};

	if (LIGHTWEIGHT_DESTINATIONS.has(destination)) {
		return {
			model: localModel,
			fallbackModel: cloudModel,
			tier: "local-fast",
		};
	}

	return {
		model: cloudModel,
		fallbackModel: null,
		tier: "cloud-premium",
	};
}
