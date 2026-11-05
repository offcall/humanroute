import { Spinner } from "./Icon";

// Full-screen loader before a page has anything to show: centred in the viewport, inside the safe area.
export const PageLoading = () => (
	<div className="page-loading" role="status">
		<Spinner />
		Loading…
	</div>
);
