import type { ReactNode } from "react";

export const Shell = ({ children }: { children: ReactNode }) => (
	<div className="app">
		<main className="app__main">
			<div className="approve">
				<span className="kicker">HumanRoute sign-in</span>
				{children}
			</div>
		</main>
	</div>
);
