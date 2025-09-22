import { FormEvent, RefObject, useRef, useState } from "react";
import { EyeIcon } from "../../primitives/icons/eye-icon.tsx";
import Content from "../../../content.ts";

export function PasswordInput({
	id,
	placeholder,
	formRef,
	validateRepeatPassword = false,
}: {
	id: string;
	placeholder: string;
	formRef?: RefObject<HTMLFormElement>;
	validateRepeatPassword?: boolean;
}) {
	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [showError, setShowError] = useState<boolean>(false);

	const [value, setValue] = useState<string>("");
	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		setValue(event.currentTarget.value);

		if (!formRef) {
			return;
		}

		const form = formRef.current;

		if (!form) {
			return;
		}

		if (validateRepeatPassword) {
			const password = form.password.value;
			const repeatPassword = form.repeatPassword.value;

			if (password !== repeatPassword) {
				form.repeatPassword.setCustomValidity(
					"Die Passwörter stimmen nicht überein.",
				);
			} else {
				form.repeatPassword.setCustomValidity("");
			}
		}

		// Validate the current password field
		if (inputRef.current) {
			setShowError(!inputRef.current.validity.valid);
		}
	};

	const handleInvalid = () => {
		setShowError(true);
	};

	const togglePasswordVisibility = () => {
		setIsPasswordVisible((prev) => !prev);
	};

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
						ref={inputRef}
						id={id}
						name={id}
						value={value}
						onInput={handleInput}
						onInvalid={handleInvalid}
						type={isPasswordVisible ? "text" : "password"}
						required
						minLength={6}
						className="w-0 grow focus:outline-none"
						placeholder={placeholder}
					/>
					<button
						type="button"
						onClick={togglePasswordVisibility}
						aria-label="Password anzeigen"
						className="focus-visible:outline-default rounded-3px cursor-pointer"
					>
						<EyeIcon
							variant={isPasswordVisible ? "struck-through" : "default"}
						/>
					</button>
				</div>

				{showError && (
					<div className="hidden group-has-[:user-invalid]:block text-berlin-rot mt-1.5 text-sm">
						{getErrorMessage(inputRef)}
					</div>
				)}
			</div>
		</>
	);
}

function getErrorMessage(ref: RefObject<HTMLInputElement>) {
	const current = ref.current;

	if (!current) {
		return "";
	}

	const validity = current.validity;

	if (!validity) {
		return "";
	}

	if (validity.tooShort) {
		return Content["form.validation.password.tooShort"];
	}

	if (validity.valueMissing) {
		return Content["form.validation.general.valueMissing"];
	}

	if (validity.customError) {
		return Content["form.validation.password.customError"];
	}

	return "";
}
