import { type FormEvent, type RefObject, useRef, useState } from "react";
import { validateEmail } from "../../../routes/register-page/validation/email-validation.ts";
import { useAuthStore } from "../../../store/auth-store.ts";
import Content from "../../../content.ts";

export function EmailInput({
	id,
	placeholder,
	className = "",
	defaultValue = "",
	useRegexValidation = false,
}: {
	id: string;
	placeholder?: string;
	className?: string;
	defaultValue?: string;
	useRegexValidation?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState<string>(defaultValue || "");
	const [showError, setShowError] = useState<boolean>(false);
	const { allowedEmailDomains } = useAuthStore();

	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		setValue(event.currentTarget.value);

		if (useRegexValidation) {
			const emailValidation = validateEmail(
				event.currentTarget.value,
				allowedEmailDomains,
			);

			if (!emailValidation.isValid) {
				event.currentTarget.setCustomValidity(
					emailValidation.error || Content["form.validation.email.customError"],
				);
			} else {
				event.currentTarget.setCustomValidity("");
			}
		}

		if (inputRef.current) {
			setShowError(!inputRef.current.validity.valid);
		}
	};

	const handleInvalid = () => {
		setShowError(true);
	};

	return (
		<>
			<input
				ref={inputRef}
				id={id}
				name={id}
				type="email"
				required
				value={value}
				onInput={handleInput}
				onInvalid={handleInvalid}
				className={`
					peer border border-schwarz-40 rounded-3px p-2.5
					focus-visible:outline-default 
					user-invalid:border-berlin-rot
					focus:text-black
					
					${className}
				`}
				placeholder={placeholder}
			/>
			{showError && (
				<div
					className="hidden peer-[:user-invalid]:block text-berlin-rot mt-1.5 text-sm"
					dangerouslySetInnerHTML={{
						__html: getErrorMessage(inputRef),
					}}
				/>
			)}
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

	if (validity.typeMismatch) {
		return Content["form.validation.email.typeMismatch"];
	}

	if (validity.valueMissing) {
		return Content["form.validation.general.valueMissing"];
	}

	if (validity.customError) {
		return Content["form.validation.email.customError"];
	}

	return "";
}
