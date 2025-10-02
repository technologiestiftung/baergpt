import { type FormEvent, type RefObject, useRef, useState } from "react";
import Content from "../../../content.ts";

export function TextInput({
	id,
	placeholder,
	className = "",
	isRequired = true,
	defaultValue = "",
}: {
	id: string;
	placeholder?: string;
	className?: string;
	isRequired?: boolean;
	defaultValue?: string;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState<string>(defaultValue || "");
	const [showError, setShowError] = useState<boolean>(false);

	const handleInput = (event: FormEvent<HTMLInputElement>) => {
		setValue(event.currentTarget.value);

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
				type="text"
				id={id}
				name={id}
				required={isRequired}
				value={value}
				onInput={handleInput}
				onInvalid={handleInvalid}
				className={`
					peer w-full
					border border-schwarz-40 rounded-3px p-2.5
					hover:border-schwarz-100
					focus-visible:outline-default 
					user-invalid:border-berlin-rot
					text-base leading-6 font-normal 
					${className} ${!isRequired && "placeholder:text-schwarz-40"}
				`}
				placeholder={placeholder}
			/>

			{showError && (
				<div className="text-berlin-rot mt-1.5 text-sm">
					{getErrorMessage(inputRef)}
				</div>
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

	if (validity.valueMissing) {
		return Content["form.validation.general.valueMissing"];
	}

	return "";
}
