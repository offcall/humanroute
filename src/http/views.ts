// Shared HTML layout. Plain server-rendered pages, mobile first, no client framework.

export const esc = (raw: string): string =>
	raw.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export const secondsLeft = (deadlineAt: number, now: number): number =>
	Math.max(0, Math.ceil((deadlineAt - now) / 1000));

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:16px/1.45 -apple-system,system-ui,sans-serif;background:#f4f4f6;color:#111}
main{max-width:640px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:4px 0 16px}
.card{background:#fff;border-radius:12px;padding:14px;margin:0 0 12px;box-shadow:0 1px 3px #0002}
.meta{display:flex;justify-content:space-between;font-size:13px;color:#666;margin-bottom:8px}
.left{font-weight:600;color:#b45309}.left.over{color:#b91c1c}
.label{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:10px 0 2px}
.text,.draft,pre{white-space:pre-wrap}.draft{color:#555;font-style:italic}
textarea{width:100%;min-height:120px;font:inherit;padding:10px;border:1px solid #ccc;border-radius:8px}
button{width:100%;margin-top:10px;padding:14px;font:inherit;font-weight:600;border:0;border-radius:8px;background:#111;color:#fff}
.empty{color:#888;text-align:center;padding:40px 0}
.msg{background:#fff;border-radius:12px;padding:14px;margin-bottom:12px}
.msg.err{border-left:4px solid #b91c1c}.msg.ok{border-left:4px solid #15803d}
.state{display:inline-block;padding:.2rem .6rem;border-radius:.4rem;background:#eee;font-weight:600}
.released{background:#d4f5d4}.refunded{background:#fde2c8}.answered{background:#dbe8ff}
.releasing,.refunding{background:#fff3c4}
dt{color:#666;font-size:.85rem;margin-top:.6rem}dd{margin:0}
`;

// Cosmetic countdown; the server enforces the deadline.
const TICK = `<script>
setInterval(function(){document.querySelectorAll('[data-left]').forEach(function(el){
var s=Math.max(0,+el.dataset.left-1);el.dataset.left=s;el.textContent=s>0?s+'s left':'expired';
if(s===0)el.classList.add('over');});},1000);
</script>`;

export const page = (
	title: string,
	body: string,
	refreshSeconds?: number,
): string => {
	const refresh = refreshSeconds
		? `<meta http-equiv="refresh" content="${refreshSeconds}">`
		: "";
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${refresh}
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>${body}</main>${TICK}</body></html>`;
};

export const countdown = (deadlineAt: number, now: number): string => {
	const left = secondsLeft(deadlineAt, now);
	return `<span class="left${left === 0 ? " over" : ""}" data-left="${left}">${left > 0 ? `${left}s left` : "expired"}</span>`;
};

export const message = (
	backHref: string,
	text: string,
	success: boolean,
): string => {
	const back = `<p><a href="${esc(backHref)}">← Inbox</a></p>`;
	return page(
		"HumanRoute",
		`${back}<div class="msg ${success ? "ok" : "err"}">${esc(text)}</div>`,
	);
};
