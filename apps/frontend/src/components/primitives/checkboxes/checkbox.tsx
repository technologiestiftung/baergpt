import React, { useRef, useState } from "react";
import { CheckboxIcon } from "../icons/checkbox-icon.tsx";
import Content from "../../../content.ts";

interface CheckboxProps {
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	ariaLabel?: string;
	children?: React.ReactNode | string;
	required?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({
	id,
	checked,
	onChange,
	ariaLabel,
	children,
	required = false,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [error, setError] = useState("");

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.currentTarget.checked);

		if (inputRef.current && !inputRef.current.checkValidity()) {
			setError(getErrorMessage(inputRef));
		} else {
			setError("");
		}
	};

	const handleInvalid = () => {
		setError(getErrorMessage(inputRef));
	};

	const state = checked ? "checked" : "unchecked";

	return (
		<>
			<label
				className={`flex items-center gap-x-2 md:gap-x-1 ${error ? "w-fit border border-berlin-rot rounded-sm pr-1.5" : ""}`}
				htmlFor={`${id}-checkbox`}
			>
				<span className="flex h-fit cursor-pointer rounded-1.5px group/checkbox has-[:focus-visible]:outline-default">
					<CheckboxIcon state={state} />
					<input
						ref={inputRef}
						type="checkbox"
						id={`${id}-checkbox`}
						name={`${id}-checkbox`}
						className="sr-only"
						checked={checked}
						aria-label={ariaLabel}
						onChange={handleChange}
						onInvalid={handleInvalid}
						required={required}
					/>
				</span>
				{children}
			</label>
			{error && <div className="text-berlin-rot text-sm mt-1.5">{error}</div>}
		</>
	);
};

function getErrorMessage(ref: React.RefObject<HTMLInputElement>): string {
	const current = ref.current;
	if (!current) {
		return "";
	}

	const validity = current.validity;
	if (validity.valueMissing) {
		if (current.id === "has-accepted-privacy-checkbox") {
			return Content["form.validation.privacy.required.error"];
		}
		return Content["form.validation.general.valueMissing"];
	}

	return "";
}

export default Checkbox;
