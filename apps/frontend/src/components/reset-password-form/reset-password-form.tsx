import React, { type FormEvent } from "react";
import Content from "../../content.ts";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useTooltipStore } from "../../store/tooltip-store.ts";
import { QuestionMarkIcon } from "../primitives/icons/question-mark-icon.tsx";
import { PasswordInput } from "../primitives/text-inputs/password-input.tsx";
import { ArrowWhiteRightIcon } from "../primitives/icons/arrow-white-right-icon.tsx";

export function ResetPasswordForm() {
	const { error } = useAuthErrorStore();
	const { resetPassword, isPasswordRecoveryMode } = useAuthStore();
	const { showTooltip, hideTooltip } = useTooltipStore();

	const handleChange = (event: React.ChangeEvent<HTMLFormElement>) => {
		const password = event.currentTarget.password.value;
		const repeatPassword = event.currentTarget.repeatPassword.value;

		const isDifferent = password !== repeatPassword;

		if (isDifferent) {
			event.currentTarget.repeatPassword.setCustomValidity(
				Content["form.validation.password.repeatPasswordShouldMatch.error"],
			);
			return;
		}

		event.currentTarget.repeatPassword.setCustomValidity("");
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!isPasswordRecoveryMode) {
			useAuthErrorStore
				.getState()
				.handleError(
					new Error(
						"Passwort-Zurücksetzung ist nicht aktiv. Bitte verwenden Sie den Link aus Ihrer E-Mail.",
					),
				);
			return;
		}

		const password = event.currentTarget.password.value;
		try {
			await resetPassword(password);
		} catch (err) {
			useAuthErrorStore
				.getState()
				.handleError(
					new Error(err instanceof Error ? err.message : String(err)),
				);
		}
	};

	const handleShowPasswordTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		showTooltip({
			event,
			content: Content["registerPage.passwordTooltip"],
			width: "13rem",
		});
	};

	return (
		<div className="flex flex-col min-h-[95svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-24">
			<div className="flex flex-col border max-w-[580px] w-full border-black py-8 px-5 md:p-10 rounded-3px bg-white">
				<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
					{Content["newPassword.h1"]}
				</h1>
				<h2 className="text-xl">{Content["newPassword.h2"]}</h2>

				<form
					className="flex flex-col mt-12"
					onSubmit={handleSubmit}
					onChange={handleChange}
				>
					<label
						htmlFor="password"
						className="flex flex-col mt-4 md:mt-7 gap-y-1 text-sm md:text-base"
					>
						<span className="flex gap-x-1 items-center">
							{Content["newPassword.password.label"]}
							<button
								type="button"
								className="rounded-3px focus-visible:outline-default"
								onMouseEnter={handleShowPasswordTooltip}
								onMouseLeave={hideTooltip}
								onFocus={handleShowPasswordTooltip}
								onBlur={hideTooltip}
							>
								<QuestionMarkIcon />
							</button>
						</span>
						<PasswordInput
							id="password"
							placeholder={Content["newPassword.password.placeholder"]}
							minLength={10}
						/>
					</label>

					<label
						htmlFor="repeatPassword"
						className="flex flex-col mt-4 md:mt-7 gap-y-1 text-sm md:text-base"
					>
						{Content["newPassword.repeatPassword.label"]}
						<PasswordInput
							id="repeatPassword"
							placeholder={Content["newPassword.repeatPassword.placeholder"]}
							minLength={10}
						/>
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
						{Content["newPassword.submitButton"]}
						<ArrowWhiteRightIcon />
					</button>
				</form>
			</div>
		</div>
	);
}
