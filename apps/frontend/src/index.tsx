import "./monitoring/sentry";
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { PostHogProvider } from "posthog-js/react";
import "./index.css";
import { IndexPage } from "./routes";
import { RegisterPage } from "./routes/register-page";
import { LoginPage } from "./routes/login-page";
import { AccountActivated } from "./routes/account-activated";
import { RequestResetPasswordPage } from "./routes/request-password-reset";
import { ResetPasswordPage } from "./routes/reset-password";
import { ConfirmOtpPage } from "./routes/confirm-otp";
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
		path: "/request-password-reset/",
		element: <RequestResetPasswordPage />,
	},
	{
		path: "/confirm-otp/",
		element: <ConfirmOtpPage />,
	},
	{
		path: "/reset-password/",
		element: <ResetPasswordPage />,
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

	const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
	const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

	ReactDOM.createRoot(root).render(
		<React.StrictMode>
			{posthogKey && posthogHost ? (
				<PostHogProvider
					apiKey={posthogKey}
					options={{
						api_host: posthogHost,
					}}
				>
					<RouterProvider router={router} />
				</PostHogProvider>
			) : (
				<RouterProvider router={router} />
			)}
		</React.StrictMode>,
	);
}

render();
