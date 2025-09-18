import { FormEvent, useRef } from "react";
import { EmailInput } from "../../components/primitives/text-inputs/email-input.tsx";
import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import { PasswordResetLayout } from "../../layouts/pasword-reset-layout.tsx";

export function ResetPasswordPage() {
	const { error } = useAuthErrorStore();
	const { requestPasswordReset } = useAuthStore();
	const formRef = useRef<HTMLFormElement | null>(null);

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const email = event.currentTarget.email.value;

		requestPasswordReset(email);
	};

	return (
		<PasswordResetLayout>
			<div className="flex flex-col min-h-[90svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-[100px]">
				<div className="flex flex-col border max-w-[580px] w-full border-black py-8 px-5 md:p-10 rounded-3px bg-white">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["resetPassword.h1"]}
					</h1>
					<h2 className="text-xl">{Content["resetPassword.h2"]}</h2>

					<form
						className="flex flex-col mt-9"
						ref={formRef}
						onSubmit={handleSubmit}
					>
						<label htmlFor="email" className="flex flex-col gap-y-1">
							{Content["resetPassword.emailLabel"]}
							<EmailInput id="email" placeholder="vorname.nachname@berlin.de" />
						</label>

						{error && (
							<div
								className="text-berlin-rot mt-4 text-sm"
								dangerouslySetInnerHTML={{ __html: error }}
							/>
						)}

						<button
							type="submit"
							className={`
                                flex gap-x-2 text-lg mt-12 self-end items-center
                                w-fit py-2 px-3 text-white rounded-3px 
                                bg-dunkelblau-100 disabled:bg-schwarz-40
                                hover:bg-dunkelblau-80 focus-visible:outline-default 
                            `}
						>
							{Content["resetPassword.submitButton"]}
							<ArrowWhiteRightIcon />
						</button>
					</form>
				</div>
			</div>
		</PasswordResetLayout>
	);
}
