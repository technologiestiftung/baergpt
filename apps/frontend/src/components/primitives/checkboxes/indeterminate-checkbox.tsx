import React, { useEffect, useRef } from "react";
import { CheckboxIcon, type CheckboxState } from "../icons/checkbox-icon.tsx";
import Content from "../../../content.ts";

interface CheckboxProps {
	children: React.ReactNode | string;
	id: string;
	state: CheckboxState;
	onChange: (state: CheckboxState) => void;
}

export const IndeterminateCheckbox: React.FC<CheckboxProps> = ({
	children,
	id,
	state,
	onChange,
}) => {
	const ref = useRef<HTMLInputElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.currentTarget.checked) {
			onChange("checked");
			return;
		}

		if (!e.currentTarget.checked) {
			onChange("unchecked");
			return;
		}
	};

	useEffect(() => {
		if (!ref.current) {
			return;
		}

		ref.current.indeterminate = state === "indeterminate";
		ref.current.checked = state === "checked";
	}, [state]);

	return (
		<label
			className={`
			flex h-fit items-center cursor-pointer group text-sm leading-5 font-semibold text-dunkelblau-100`}
			aria-label={Content["indeterminateCheckbox.ariaLabel"]}
			htmlFor={`${id}-checkbox`}
		>
			<span
				className={`h-fit rounded-1.5px group/checkbox group-has-[:focus]:outline-default shrink-0 flex`}
			>
				<CheckboxIcon state={state} />
			</span>
			<input
				ref={ref}
				type="checkbox"
				id={`${id}-checkbox`}
				className="appearance-none size-0 focus-visible:outline-none"
				onChange={handleChange}
			/>
			<span className="ml-2">{children}</span>
		</label>
	);
};
