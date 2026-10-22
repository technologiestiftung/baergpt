import { useId, useState } from "react";
import Content from "../../../content.ts";
import { EyeIcon } from "../icons/eye-icon.tsx";

interface PasswordInputProps {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	label?: string;
	isInvalid?: boolean;
	disabled?: boolean;
	autoFocus?: boolean;
	ariaDescribedBy?: string;
}

export function PasswordInput({
	id,
	value,
	onChange,
	label,
	isInvalid,
	disabled,
	autoFocus,
	ariaDescribedBy,
}: PasswordInputProps) {
	const [isRevealed, setIsRevealed] = useState(false);
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<div
			className={`flex items-center gap-2 h-10 px-3 rounded-3px border bg-white
				${
					isInvalid
						? "border-warning-100"
						: "border-dunkelblau-50 has-[input:focus]:border-aktiv-blau-100 has-[input:focus]:shadow-[0_0_0_2px_rgba(26,115,232,0.4)]"
				}
				${disabled ? "bg-hellblau-50" : ""}`}
		>
			<input
				id={inputId}
				name={inputId}
				type={isRevealed ? "text" : "password"}
				autoComplete="off"
				aria-label={label}
				aria-invalid={isInvalid}
				aria-describedby={ariaDescribedBy}
				value={value}
				disabled={disabled}
				autoFocus={autoFocus}
				onChange={(event) => onChange(event.target.value)}
				className="flex-1 min-w-0 text-sm leading-5 font-normal text-dunkelblau-100 outline-none disabled:text-dunkelblau-70 disabled:bg-transparent"
			/>
			<button
				type="button"
				onClick={() => setIsRevealed((revealed) => !revealed)}
				aria-label={
					isRevealed
						? Content["passwordInput.hide.ariaLabel"]
						: Content["passwordInput.show.ariaLabel"]
				}
				className="shrink-0 focus-visible:outline-default rounded-3px"
			>
				<EyeIcon variant={isRevealed ? "struck-through" : "default"} />
			</button>
		</div>
	);
}
