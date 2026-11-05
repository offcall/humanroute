import { useEffect, useState } from "react";
import { type Agency, parseJoinPreview, request } from "../shared";

export enum InviteState {
	Loading = "loading",
	Found = "found",
	NotFound = "not-found",
	// preview failed for another reason: join still works, the name stays hidden
	Unknown = "unknown",
}

export type Invite =
	| { state: InviteState.Found; agency: Agency }
	| { state: Exclude<InviteState, InviteState.Found> };

// Public invite preview: the agency name before sign-in; 404 = unknown invite.
export const useInvite = (inviteCode: string): Invite => {
	const [invite, setInvite] = useState<Invite>({ state: InviteState.Loading });

	useEffect(() => {
		let live = true;
		const url = `/api/linguist/join/${encodeURIComponent(inviteCode)}`;
		setInvite({ state: InviteState.Loading });

		void request("GET", url, undefined, parseJoinPreview).then((res) => {
			if (!live) {
				return;
			}
			if (res.ok) {
				setInvite({ state: InviteState.Found, agency: res.value.agency });
				return;
			}
			setInvite({
				state: res.status === 404 ? InviteState.NotFound : InviteState.Unknown,
			});
		});

		return () => {
			live = false;
		};
	}, [inviteCode]);

	return invite;
};
