import React from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../ui/select";
import { Label } from "@/components/ui/label";

interface SelectFieldProps {
	id: string;
	label: string;
	value: string;
	placeholder: string;
	defaultOption: string;
	options: readonly string[];
	onValueChange: (value: string) => void;
}

export const SelectField: React.FC<SelectFieldProps> = ({
	id,
	label,
	value,
	placeholder,
	defaultOption,
	options,
	onValueChange,
}) => {
	// use a controlled value - convert empty string to "default" for display
	const selectValue = value === "" ? "default" : value;

	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Select value={selectValue} onValueChange={onValueChange}>
				<SelectTrigger id={id}>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="default">{defaultOption}</SelectItem>
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
