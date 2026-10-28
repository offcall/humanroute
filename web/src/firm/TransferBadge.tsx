import type { Transfer } from "../shared";

export const TransferBadge = ({ transfer }: { transfer: Transfer | null }) => {
	if (transfer === null) {
		return null;
	}

	return (
		<span>
			Money: {transfer.status} ({transfer.memo})
			{transfer.explorerUrl === null ? null : (
				<>
					{" "}
					<a href={transfer.explorerUrl} target="_blank" rel="noreferrer">
						tx
					</a>
				</>
			)}
			{transfer.lastError === null ? null : (
				<span className="error"> {transfer.lastError}</span>
			)}
		</span>
	);
};
