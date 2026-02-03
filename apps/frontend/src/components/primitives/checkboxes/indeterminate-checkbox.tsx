import React, { useEffect, useRef } from "react";
import { CheckboxIcon, type CheckboxState } from "../icons/checkbox-icon.tsx";
import { useMobileMenuStore } from "../../../store/use-mobile-menu.ts";
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
	const { isMobileCheckboxVisible } = useMobileMenuStore();
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
			flex h-fit gap-x-2 items-center cursor-pointer group text-sm leading-5 font-semibold text-dunkelblau-100`}
			aria-label={Content["indeterminateCheckbox.ariaLabel"]}
			htmlFor={`${id}-checkbox`}
		>
			<span
				className={`h-fit rounded-1.5px group/checkbox group-has-[:focus]:outline-default shrink-0 ${isMobileCheckboxVisible ? "flex" : "hidden"} md:flex`}
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
			{children}
		</label>
	);
};
