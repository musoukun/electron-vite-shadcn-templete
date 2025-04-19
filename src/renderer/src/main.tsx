import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/main.css";
import { ToasterProvider } from "@/components/ui/toaster";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<ToasterProvider>
			<App />
		</ToasterProvider>
	</React.StrictMode>
);
