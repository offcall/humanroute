// Push subscriptions per linguist (ADR 0029): at most 5 devices, newest kept.
import { describe, expect, test } from "vitest";
import { openStore } from "../store/index.js";
import { START, testClock } from "../testing/index.js";
import { notifySlice } from "./migrations.js";
import { saveSubscription, subscriptionsOf } from "./repo.js";

const device = (index: number) => ({
	endpoint: `https://fcm.googleapis.com/fcm/send/device-${index}`,
	p256dh: `p256dh-${index}`,
	auth: `auth-${index}`,
});

const setup = () => {
	const clock = testClock();
	const { database } = openStore(":memory:", clock.now, [notifySlice]);
	const endpoints = (linguistId: string) =>
		subscriptionsOf(database, [linguistId])
			.map((target) => target.endpoint)
			.sort();
	return { clock, database, endpoints };
};

const names = (indexes: number[]) =>
	indexes.map((index) => device(index).endpoint).sort();

describe("push subscriptions", () => {
	test("keeps at most 5 devices per linguist and moves a re-subscribed device to the last linguist", () => {
		const { clock, database, endpoints } = setup();
		for (const index of [1, 2, 3, 4, 5, 6]) {
			clock.advance(1000);
			saveSubscription(database, "ling-a", device(index), clock.now());
		}
		expect(endpoints("ling-a")).toEqual(names([2, 3, 4, 5, 6]));

		clock.advance(1000);
		saveSubscription(database, "ling-b", device(4), clock.now());
		expect(endpoints("ling-a")).toEqual(names([2, 3, 5, 6]));
		expect(endpoints("ling-b")).toEqual(names([4]));
	});

	test("refreshing an existing device at an equal timestamp does not evict the refreshed device", () => {
		const { database, endpoints } = setup();
		for (const index of [1, 2, 3, 4, 5]) {
			saveSubscription(database, "ling-a", device(index), START);
		}

		saveSubscription(
			database,
			"ling-a",
			{ ...device(1), auth: "auth-new" },
			START,
		);
		saveSubscription(database, "ling-a", device(6), START);

		expect(endpoints("ling-a")).toEqual(names([1, 3, 4, 5, 6]));
		const refreshed = subscriptionsOf(database, ["ling-a"]).find(
			(target) => target.endpoint === device(1).endpoint,
		);
		expect(refreshed?.auth).toBe("auth-new");
	});
});
