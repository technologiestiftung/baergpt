import { FormEvent, useState } from "react";

export function DropDown({
	id,
	className = "",
	options,
}: {
	id: string;
	className?: string;
	options: readonly string[];
}) {
	const [value, setValue] = useState<string>("");

	const handleInput = (event: FormEvent<HTMLSelectElement>) => {
		setValue(event.currentTarget.value);
	};
	return (
		<div className="grid">
			<svg
				className="relative z-10 col-start-1 row-start-1 self-center justify-self-end right-2"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
			>
				<path
					d="M14.5916 5.25911L7.92497 11.9258L1.2583 5.25911L2.44163 4.07578L7.92497 9.55911L13.4083 4.07578L14.5916 5.25911Z"
					fill="#030812"
				/>
			</svg>
			<select
				id={id}
				name={id}
				required
				value={value}
				onChange={handleInput}
				className={`
                    peer appearance-none col-start-1 row-start-1 cursor-pointer
                    border border-schwarz-40 rounded-3px p-2.5
                    focus-visible:outline-default hover:bg-hellblau-30
                    ${className}
                `}
			>
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</div>
	);
}
