import { useState } from "react";
import { Link } from "react-router";
import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";
import { useErrorStore } from "../../store/error-store.ts";

export function UnconfirmedEmail() {
	const { resendConfirmationEmail, unconfirmedEmail, resetUnconfirmedEmail } =
		useAuthStore();
	const [emailSent, setEmailSent] = useState(false);

	const handleResendEmail = async () => {
		try {
			await resendConfirmationEmail();
			setEmailSent(true);

			setTimeout(() => {
				setEmailSent(false);
			}, 5000);
		} catch (error) {
			useErrorStore.getState().handleError(error);
			setEmailSent(false);
		}
	};

	return (
		<div className="flex w-full min-h-[95svh] justify-center items-center bg-hellblau-100 px-6">
			<div className="bg-white w-full rounded-3px max-w-4xl border border-black flex flex-col p-6 md:py-10 md:px-12">
				<h1 className="text-xl md:text-4xl mt-1 leading-8">
					{Content["unconfirmedEmail.h2"]}
				</h1>

				<p className="leading-6 md:text-xl md:leading-7 max-w-[170rem] mt-4 md:mt-8">
					{Content["unconfirmedEmail.text.beforeEmail"]}{" "}
					<strong>{unconfirmedEmail}</strong>
					<br />
					{Content["unconfirmedEmail.text.afterEmail"]}
				</p>

				<div className="mt-10 md:mt-16 w-full">
					<span className="text-lg leading-7 font-semibold">
						{Content["unconfirmedEmail.p"]}
					</span>
					<ul className="list-disc leading-6 md:text-lg md:leading-7 font-normal max-w-[170rem] ml-5 mt-2 md:mt-2">
						<li>
							{Content["unconfirmedEmail.wrongEmail.question"]}{" "}
							<Link
								to="/register/"
								onClick={resetUnconfirmedEmail}
								className="font-semibold underline hover:no-underline"
							>
								{Content["unconfirmedEmail.wrongEmail.link"]}
							</Link>
						</li>
						<li>{Content["unconfirmedEmail.list1.li1"]}</li>
						<li>{Content["unconfirmedEmail.list1.li2"]}</li>
					</ul>
					{emailSent ? (
						<span className="ml-5 leading-6 md:text-lg md:leading-7 font-semibold text-mittelgruen">
							{Content["unconfirmedEmail.resend.success"]}
						</span>
					) : (
						<button
							className="ml-5 leading-6 md:text-lg md:leading-7 font-semibold underline hover:no-underline"
							onClick={handleResendEmail}
						>
							{Content["unconfirmedEmail.resendButton"]}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
