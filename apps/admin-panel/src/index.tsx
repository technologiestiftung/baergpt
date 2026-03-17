import React from "react";
import ReactDOM from "react-dom/client";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { IndexPage } from "./routes";
import { BaseKnowledgePage } from "./routes/base-knowledge/index";
import { LoginPage } from "./routes/login-page";
import { ProductDashboardPage } from "@/routes/product-dashboard";

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
		path: "/login/",
		element: <LoginPage />,
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
