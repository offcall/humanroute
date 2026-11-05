// Service worker (ADR 0029): shows new-task pushes and opens the linguist cabinet.
// No fetch handler and no cache: the app still needs the network (ADR 0026).
declare const self: ServiceWorkerGlobalScope;

type Notice = {
	taskId: string;
	source: string;
	target: string;
	deadline: string;
};

const CABINET = "/linguist";

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
	typeof raw === "object" && raw !== null && !Array.isArray(raw);

const readJson = (event: PushEvent): unknown => {
	try {
		return event.data?.json();
	} catch {
		return undefined;
	}
};

const parseNotice = (raw: unknown): Notice | null => {
	if (!isRecord(raw)) {
		return null;
	}
	const { taskId, source, target, claimDeadline } = raw;
	if (
		typeof taskId !== "string" ||
		typeof source !== "string" ||
		typeof target !== "string" ||
		typeof claimDeadline !== "string"
	) {
		return null;
	}
	const time = new Date(claimDeadline);
	const deadline = Number.isNaN(time.getTime())
		? ""
		: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	return { taskId, source, target, deadline };
};

// Every push shows a notification: iOS drops the subscription of a silent one.
const show = (notice: Notice | null): Promise<void> => {
	const pair =
		notice === null
			? ""
			: ` ${notice.source.toUpperCase()}→${notice.target.toUpperCase()}`;
	const body =
		notice === null || notice.deadline === ""
			? "Open the board to claim it."
			: `Claim by ${notice.deadline}.`;

	return self.registration.showNotification(`New task${pair}`, {
		body,
		icon: "/icon-192.png",
		...(notice === null ? {} : { tag: notice.taskId }),
	});
};

const focusOrOpen = async (): Promise<void> => {
	const windows = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	const open = windows.find((client) =>
		new URL(client.url).pathname.startsWith(CABINET),
	);
	if (open !== undefined) {
		await open.focus();
		return;
	}
	await self.clients.openWindow(CABINET);
};

self.addEventListener("push", (event) => {
	event.waitUntil(show(parseNotice(readJson(event))));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	event.waitUntil(focusOrOpen());
});

export {};
