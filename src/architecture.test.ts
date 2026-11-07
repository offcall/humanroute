// Import rules of ADR 0019 and the test-only exceptions of ADR 0037, read from the TypeScript AST.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = [
	"src",
	"mcp",
	"web/src",
	"web/public/agent",
	"agent",
	"scripts",
	"contracts",
	"e2e",
];
const CLIENT_DIRS = ["mcp", "web", "agent", "scripts"];

// ADR 0019 table: production slice -> slices it may import. http composes every slice's routes.
const ALLOWED: Record<string, string[]> = {
	config: [],
	store: ["config"],
	chain: ["config"],
	auth: ["store", "config"],
	accounts: ["store"],
	orders: ["store", "config", "accounts", "tasks"],
	tasks: ["store", "accounts"],
	payouts: ["store", "chain", "tasks"],
	rating: ["store", "tasks"],
	notify: ["store", "config", "accounts"],
};
// Composition and test support, not slices: src/wiring, src/testing and root entry files.
const COMPOSITION = ["wiring", "testing"];

type Edge = { from: string; to: string; typeOnly: boolean };

const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return entry.name === "node_modules" || entry.name === "dist"
				? []
				: walk(path);
		}
		const source = /\.(ts|tsx|mjs)$/.test(entry.name);
		return source && !entry.name.endsWith(".d.ts") ? [path] : [];
	});

const posix = (path: string): string =>
	relative(ROOT, path).split(sep).join("/");

const resolveSpec = (from: string, spec: string): string => {
	const base = resolve(dirname(from), spec);
	const candidates = [
		base,
		base.replace(/\.js$/, ".ts"),
		base.replace(/\.js$/, ".tsx"),
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
	];
	const found = candidates.find(
		(path) => existsSync(path) && statSync(path).isFile(),
	);
	if (found === undefined) {
		throw new Error(`${posix(from)} imports unresolved ${spec}`);
	}
	return posix(found);
};

const isTypeOnlyImport = (node: ts.ImportDeclaration): boolean => {
	const clause = node.importClause;
	if (clause === undefined) {
		return false;
	}
	if (clause.isTypeOnly) {
		return true;
	}
	const named = clause.namedBindings;
	return (
		clause.name === undefined &&
		named !== undefined &&
		ts.isNamedImports(named) &&
		named.elements.length > 0 &&
		named.elements.every((element) => element.isTypeOnly)
	);
};

// Relative imports, re-exports and literal dynamic imports; packages are not edges.
const edgesOf = (path: string): Edge[] => {
	const file = ts.createSourceFile(
		path,
		readFileSync(path, "utf8"),
		ts.ScriptTarget.Latest,
		true,
	);
	const edges: Edge[] = [];
	const add = (spec: string, typeOnly: boolean) => {
		if (spec.startsWith(".")) {
			edges.push({ from: posix(path), to: resolveSpec(path, spec), typeOnly });
		}
	};
	const visit = (node: ts.Node): void => {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			add(node.moduleSpecifier.text, isTypeOnlyImport(node));
		}
		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier !== undefined &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			add(node.moduleSpecifier.text, node.isTypeOnly);
		}
		const [first] = ts.isCallExpression(node) ? node.arguments : [];
		if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			first !== undefined &&
			ts.isStringLiteral(first)
		) {
			add(first.text, false);
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	return edges;
};

const EDGES = SOURCE_DIRS.flatMap((dir) => walk(join(ROOT, dir))).flatMap(
	edgesOf,
);

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path);
const under = (path: string, dir: string): boolean =>
	path.startsWith(`${dir}/`);
// "src/<slice>/..." -> slice; root entry files (src/index.ts, ...) -> null.
const sliceOf = (path: string): string | null => {
	const parts = path.split("/");
	return parts[0] === "src" && parts.length > 2 ? (parts[1] ?? null) : null;
};
const isProduction = (path: string): boolean =>
	!isTest(path) &&
	!under(path, "src/testing") &&
	!under(path, "contracts") &&
	!under(path, "e2e");
const show = (edges: Edge[]): string[] =>
	edges.map((edge) => `${edge.from} -> ${edge.to}`);

describe("architecture (ADR 0019, ADR 0037)", () => {
	it("AR-00 the walk sees the gateway, clients and tests", () => {
		const froms = new Set(EDGES.map((edge) => edge.from.split("/")[0]));
		expect([...froms].sort()).toEqual(
			expect.arrayContaining(["contracts", "mcp", "src", "web"]),
		);
		expect(EDGES.length).toBeGreaterThan(300);
	});

	it("AR-01 slices import each other only through index.ts", () => {
		const crossing = EDGES.filter((edge) => {
			const from = under(edge.from, "src") ? sliceOf(edge.from) : null;
			const to = sliceOf(edge.to);
			if (!under(edge.from, "src") || to === null || from === to) {
				return false;
			}
			return edge.to !== `src/${to}/index.ts`;
		});
		expect(show(crossing)).toEqual([]);
	});

	it("AR-02 only the import edges listed in ADR 0019 exist between slices", () => {
		const forbidden = EDGES.filter((edge) => {
			const from = sliceOf(edge.from);
			const to = sliceOf(edge.to);
			if (
				from === null ||
				to === null ||
				from === to ||
				!isProduction(edge.from)
			) {
				return false;
			}
			if (COMPOSITION.includes(from) || to === "testing") {
				return false;
			}
			if (from === "http") {
				return false;
			}
			return !(ALLOWED[from] ?? []).includes(to);
		});
		expect(show(forbidden)).toEqual([]);
		expect(
			Object.keys(ALLOWED).every((slice) =>
				existsSync(join(ROOT, "src", slice, "index.ts")),
			),
		).toBe(true);
	});

	it("AR-03 src never imports clients or tests, and clients import only types from src/<slice>/index.ts", () => {
		const outward = EDGES.filter(
			(edge) =>
				under(edge.from, "src") &&
				!under(edge.to, "src") &&
				!under(edge.to, "node_modules"),
		);
		expect(show(outward)).toEqual([]);

		const clientIn = EDGES.filter((edge) => {
			const client = CLIENT_DIRS.some((dir) => under(edge.from, dir));
			if (!client || !under(edge.to, "src")) {
				return false;
			}
			const slice = sliceOf(edge.to);
			const publicIndex = slice !== null && edge.to === `src/${slice}/index.ts`;
			return !(publicIndex && edge.typeOnly && slice !== "testing");
		});
		expect(show(clientIn)).toEqual([]);
	});

	it("AR-04 production code never imports src/testing or test files", () => {
		const leaks = EDGES.filter(
			(edge) =>
				isProduction(edge.from) &&
				(under(edge.to, "src/testing") || isTest(edge.to)),
		);
		expect(show(leaks)).toEqual([]);
	});
});
