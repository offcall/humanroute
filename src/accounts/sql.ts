// SQL for the accounts slice: firms, agencies, linguists, invites, pairs, MCP tokens (ADR 0021). Times are Unix milliseconds.

export const ACCOUNTS_SCHEMA_SQL: string[] = [
	"CREATE TABLE firms (id TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at INTEGER NOT NULL)",
	"CREATE TABLE agencies (id TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at INTEGER NOT NULL)",
	"CREATE TABLE linguists (id TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE, agency_id TEXT NOT NULL REFERENCES agencies(id), created_at INTEGER NOT NULL)",
	"CREATE TABLE invites (code TEXT PRIMARY KEY, agency_id TEXT NOT NULL UNIQUE REFERENCES agencies(id), created_at INTEGER NOT NULL)",
	"CREATE TABLE linguist_languages (linguist_id TEXT NOT NULL REFERENCES linguists(id), source_lang TEXT NOT NULL, target_lang TEXT NOT NULL, PRIMARY KEY (linguist_id, source_lang, target_lang))",
	"CREATE TABLE mcp_tokens (token TEXT PRIMARY KEY, firm_id TEXT NOT NULL UNIQUE REFERENCES firms(id), created_at INTEGER NOT NULL)",
];

export const FIRMS_SQL = {
	insert:
		"INSERT INTO firms (id, wallet, name, created_at) VALUES (?, ?, ?, ?)",
	byWallet: "SELECT id, name, wallet FROM firms WHERE wallet = ?",
	byId: "SELECT id, name, wallet FROM firms WHERE id = ?",
	byToken:
		"SELECT firms.id, firms.name, firms.wallet FROM firms JOIN mcp_tokens ON mcp_tokens.firm_id = firms.id WHERE mcp_tokens.token = ?",
	insertToken:
		"INSERT INTO mcp_tokens (token, firm_id, created_at) VALUES (?, ?, ?)",
	token: "SELECT token FROM mcp_tokens WHERE firm_id = ?",
};

export const AGENCIES_SQL = {
	insert:
		"INSERT INTO agencies (id, wallet, name, created_at) VALUES (?, ?, ?, ?)",
	byWallet: "SELECT id, name, wallet FROM agencies WHERE wallet = ?",
	insertInvite:
		"INSERT INTO invites (code, agency_id, created_at) VALUES (?, ?, ?)",
	inviteCode: "SELECT code FROM invites WHERE agency_id = ?",
	byInvite:
		"SELECT agencies.id, agencies.name, agencies.wallet FROM agencies JOIN invites ON invites.agency_id = agencies.id WHERE invites.code = ?",
};

export const LINGUISTS_SQL = {
	insert:
		"INSERT INTO linguists (id, wallet, agency_id, created_at) VALUES (?, ?, ?, ?)",
	byWallet:
		"SELECT linguists.id AS linguist_id, linguists.wallet AS linguist_wallet, linguists.agency_id AS agency_id, agencies.wallet AS agency_wallet FROM linguists JOIN agencies ON agencies.id = linguists.agency_id WHERE linguists.wallet = ?",
	deletePairs: "DELETE FROM linguist_languages WHERE linguist_id = ?",
	insertPair:
		"INSERT INTO linguist_languages (linguist_id, source_lang, target_lang) VALUES (?, ?, ?)",
	pairs:
		"SELECT source_lang, target_lang FROM linguist_languages WHERE linguist_id = ? ORDER BY rowid",
};
