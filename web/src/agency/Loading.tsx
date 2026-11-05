import { Spinner } from "../shared";

export const Loading = () => (
	<p className="loading" role="status">
		<Spinner />
		Loading…
	</p>
);
