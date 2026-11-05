import type { ReactNode } from "react";

export const JoinShell = ({
	lead,
	children,
}: {
	lead: boolean;
	children: ReactNode;
}) => (
	<div className="app">
		<main className="app__main">
			<div className="join">
				<header className="join-top">
					<span className="brand-mark" aria-hidden="true">
						HR
					</span>
					<span className="join-top__name">HumanRoute</span>
				</header>
				<div className="join-hero">
					<span className="kicker">Invite for translators</span>
					<h1>Join an agency</h1>
					{lead ? (
						<p>
							Fix AI translations for firms. Each task pays in USDC to your
							wallet.
						</p>
					) : null}
				</div>
				{children}
			</div>
		</main>
	</div>
);
