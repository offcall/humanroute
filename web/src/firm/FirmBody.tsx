import { useEffect, useState } from "react";
import {
	type ApiResult,
	matchPath,
	navigate,
	request,
	useRoute,
} from "../shared";
import { Jobs } from "./Jobs";
import { parseFirmView } from "./parseFirmView";
import { Review } from "./Review";
import { TaskDetail } from "./TaskDetail";
import type { FirmView } from "./types";

const goHome = (event: React.MouseEvent) => {
	event.preventDefault();
	navigate("/");
};

const Loading = () => (
	<>
		<p className="loading" role="status">
			Loading your firm…
		</p>
		<span className="skeleton skeleton--line" />
		<span className="skeleton skeleton--title" />
		<span className="skeleton skeleton--block" />
	</>
);

// Sub-routes: /firm/review, /firm/jobs/:orderId/:lang, else /firm/jobs.
const FirmPage = ({ view }: { view: FirmView }) => {
	const path = useRoute();
	const detail = matchPath("/firm/jobs/:orderId/:lang", path);
	if (matchPath("/firm/review", path)) {
		return <Review />;
	}
	if (detail?.orderId !== undefined && detail.lang !== undefined) {
		return (
			<TaskDetail key={path} orderId={detail.orderId} lang={detail.lang} />
		);
	}

	return <Jobs view={view} />;
};

export const FirmBody = () => {
	const [res, setRes] = useState<ApiResult<FirmView> | undefined>(undefined);

	useEffect(() => {
		void request("GET", "/api/firm", undefined, parseFirmView).then(setRes);
	}, []);

	if (res === undefined) {
		return <Loading />;
	}
	if (!res.ok && res.status === 404) {
		return (
			<p>
				No firm yet.{" "}
				<a href="/" onClick={goHome}>
					Register firm
				</a>
			</p>
		);
	}
	if (!res.ok) {
		return <p className="error">{res.error.message ?? res.error.error}</p>;
	}

	return <FirmPage view={res.value} />;
};
