import { type FormEvent, useState } from "react";
import { EyeIcon } from "../icons/eye-icon.tsx";
import Content from "../../../content.ts";

export function PasswordInput({
	id,
	placeholder = "",
	autoComplete,
	minLength = 6,
}: {
	id: string;
	placeholder?: string;
	autoComplete?: string;
	minLength?: number;
}) {
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string>("");

	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		const target = event.currentTarget as HTMLInputElement;
		setErrorMessage(mapErrorMessage(target));
	};

	/**
	 * The field can be invalid without the user having interacted with it.
	 * e.g. when the form is submitted without filling in the field.
	 */
	const handleInvalid = (event: FormEvent<HTMLInputElement>) => {
		const target = event.currentTarget as HTMLInputElement;
		setErrorMessage(mapErrorMessage(target));
	};

	const togglePasswordVisibility = () => {
		setIsPasswordVisible((prev) => !prev);
	};

	const hasError = errorMessage !== "";

	return (
		<>
			<div className="group">
				<div
					className={`
			flex gap-2 p-2.5 
			border border-schwarz-40 rounded-3px
			focus-visible:outline-default
			has-[input:focus-visible]:outline-default
			has-[input:user-invalid]:border-berlin-rot
			`}
				>
					<input
						id={id}
						name={id}
						onInput={handleInput}
						onInvalid={handleInvalid}
						type={isPasswordVisible ? "text" : "password"}
						required
						minLength={minLength}
						className="w-0 grow focus:outline-none"
						placeholder={placeholder}
						autoComplete={autoComplete}
					/>
					<button
						type="button"
						onClick={togglePasswordVisibility}
						aria-label={
							isPasswordVisible
								? Content["registerPage.hidePassword"]
								: Content["registerPage.showPassword"]
						}
						className="focus-visible:outline-default rounded-3px cursor-pointer"
					>
						<EyeIcon
							variant={isPasswordVisible ? "struck-through" : "default"}
						/>
					</button>
				</div>

				{hasError && (
					<div className="hidden group-has-[:user-invalid]:block text-berlin-rot mt-1.5 text-sm">
						{errorMessage}
					</div>
				)}
			</div>
		</>
	);
}

function mapErrorMessage(target: HTMLInputElement) {
	if (!target.validity || target.validity.valid) {
		return "";
	}

	if (target.validity.tooShort && target.minLength === 6) {
		return Content["form.validation.login.password.tooShort"];
	}

	if (target.validity.tooShort && target.minLength === 10) {
		return Content["form.validation.password.tooShort"];
	}

	if (target.validity.valueMissing) {
		return Content["form.validation.general.valueMissing"];
	}

	if (target.validity.customError) {
		return target.validationMessage;
	}

	return "";
}
