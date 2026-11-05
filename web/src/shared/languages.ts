import { Language } from "./types";

const NAMES: Record<Language, string> = {
	[Language.En]: "English",
	[Language.Es]: "Spanish",
	[Language.Fr]: "French",
	[Language.De]: "German",
	[Language.It]: "Italian",
	[Language.Pt]: "Portuguese",
	[Language.Ru]: "Russian",
};

export const LANGUAGES = Object.values(Language);

const toLanguage = (code: string): Language | undefined =>
	LANGUAGES.find((lang) => lang === code);

// English name of a language code; an unknown code is shown as it is
export const languageName = (code: string): string => {
	const lang = toLanguage(code);

	return lang === undefined ? code : NAMES[lang];
};

export const pairCodes = (source: string, target: string): string =>
	`${source} → ${target}`;

export const pairNames = (source: string, target: string): string =>
	`${languageName(source)} → ${languageName(target)}`;

// Screen-reader text: "English to Spanish"
export const pairLabel = (source: string, target: string): string =>
	`${languageName(source)} to ${languageName(target)}`;
