import "./monitoring/sentry";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { IndexPage } from "./routes";
import { RegisterPage } from "./routes/register-page";
import { LoginPage } from "./routes/login-page";
import { AccountActivated } from "./routes/account-activated";
import { ResetPasswordPage } from "./routes/reset-password";
import { NewPasswordPage } from "./routes/new-password";
import { ProfilePage } from "./routes/profile";
import { EmailChanged } from "./routes/email-changed";
import { AccountDeleted } from "./routes/account-deleted";
import { PrivacyPolicyPage } from "./routes/privacy-policy";
import { RegistrationError } from "./routes/registration-error";
import { TermsOfUsePage } from "./routes/terms-of-use";

const router = createBrowserRouter([
	{
		path: "/",
		element: <IndexPage />,
	},
	{
		path: "/register/",
		element: <RegisterPage />,
	},
	{
		path: "/login/",
		element: <LoginPage />,
	},
	{
		path: "/account-activated/",
		element: <AccountActivated />,
	},
	{
		path: "/registration-error/",
		element: <RegistrationError />,
	},
	{
		path: "/reset-password/",
		element: <ResetPasswordPage />,
	},
	{
		path: "/new-password/",
		element: <NewPasswordPage />,
	},
	{
		path: "/profile/",
		element: <ProfilePage />,
	},
	{
		path: "/email-changed/",
		element: <EmailChanged />,
	},
	{
		path: "/account-deleted/",
		element: <AccountDeleted />,
	},
	{ path: "/privacy-policy/", element: <PrivacyPolicyPage /> },
	{ path: "/terms-of-use/", element: <TermsOfUsePage /> },
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
