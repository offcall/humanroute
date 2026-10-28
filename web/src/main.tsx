import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Routes } from "./routes";
import { SessionProvider } from "./shared";
import "./shared/styles.css";

const container = document.getElementById("root");

if (container) {
	createRoot(container).render(
		<StrictMode>
			<SessionProvider>
				<Routes />
			</SessionProvider>
		</StrictMode>,
	);
}
