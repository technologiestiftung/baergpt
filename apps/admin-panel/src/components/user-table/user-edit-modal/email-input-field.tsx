import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Content from "../../../content";

interface EmailInputFieldProps {
	defaultValue: string;
	error: string;
	updated: boolean;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EmailInputField: React.FC<EmailInputFieldProps> = ({
	defaultValue,
	error,
	updated,
	onChange,
}) => {
	return (
		<>
			<Label htmlFor="email">{Content["userEditModal.form.email"]}</Label>
			<Input
				id="email"
				type="email"
				defaultValue={defaultValue}
				onChange={onChange}
				placeholder={Content["userEditModal.form.emailPlaceholder"]}
			/>
			{error && <p className="text-sm text-red-500">{error}</p>}
			{updated && (
				<p className="text-sm text-green-500">
					{Content["userEditModal.form.emailUpdatedSuccess"] ||
						"Email updated successfully."}
				</p>
			)}
		</>
	);
};
