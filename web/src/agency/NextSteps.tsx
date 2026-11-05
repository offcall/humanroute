import { shortWallet } from "../shared";

export const NextSteps = ({ wallet }: { wallet: string }) => (
	<ol className="ag-steps" aria-label="What happens next">
		<li>
			<b>1</b>
			<span>
				<strong>Create the agency</strong> with this wallet,{" "}
				<code className="code-chip">{shortWallet(wallet)}</code>. Your share is
				paid to it.
			</span>
		</li>
		<li>
			<b>2</b>
			<span>
				<strong>Add linguists</strong> with one permanent invite link. They open
				it in Phantom on their phone.
			</span>
		</li>
		<li>
			<b>3</b>
			<span>
				<strong>Earn a share</strong> of every task they deliver on time and the
				firm approves.
			</span>
		</li>
	</ol>
);
