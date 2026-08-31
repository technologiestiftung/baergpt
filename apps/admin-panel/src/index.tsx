import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { IndexPage } from "./routes";
import { BaseKnowledgePage } from "./routes/base-knowledge/index";
import { LoginPage } from "./routes/login-page";
import { ConfirmOtpPage } from "./routes/confirm-otp";
import { ProductDashboardPage } from "@/routes/product-dashboard";
import { DomainAllowlistPage } from "./routes/domain-allowlist/index";
import { IndividualEmailAllowlistPage } from "./routes/individual-email-allowlist/index";

const router = createBrowserRouter([
	{
		path: "/",
		element: <IndexPage />,
	},
	{
		path: "/base-knowledge/",
		element: <BaseKnowledgePage />,
	},
	{
		path: "/product-dashboard/",
		element: <ProductDashboardPage />,
	},
	{
		path: "/domain-allowlist/",
		element: <DomainAllowlistPage />,
	},
	{
		path: "/individual-email-allowlist/",
		element: <IndividualEmailAllowlistPage />,
	},
	{
		path: "/login/",
		element: <LoginPage />,
	},
	{
		path: "/confirm-otp/",
		element: <ConfirmOtpPage />,
	},
]);

function render() {
	const root = document.getElementById("root");

	if (!root) {
		return;
	}

	ReactDOM.createRoot(root).render(
		<React.StrictMode>
			<RouterProvider router={router} />
		</React.StrictMode>,
	);
}

render();
