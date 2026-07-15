import React, { useState, useRef, type FormEvent } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { Label } from "../ui/label";
import Content from "../../content";
import { useUserErrorStore } from "@/store/user-error-store";
import { useIndividualEmailStore } from "@/store/use-individual-email-store";

export const AddIndividualEmailForm: React.FC = () => {
	const [isEmailAdded, setIsEmailAdded] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const emailInputRef = useRef<HTMLInputElement>(null);

	const { addAllowedIndividualEmail } = useIndividualEmailStore();
	const { error, clearErrors } = useUserErrorStore();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const email = event.currentTarget.email.value.trim().toLowerCase();

		await addAllowedIndividualEmail(email);

		if (!useUserErrorStore.getState().error) {
			setIsEmailAdded(true);
			formRef.current?.reset();
			setTimeout(() => setIsEmailAdded(false), 2_000);
		}
	};

	return (
		<div className="w-fit self-start max-w-screen-xl border border-gray-200 rounded-lg p-4 mb-8">
			<h2 className="text-lg font-semibold">
				{Content["addNewIndividualEmail.title"]}
			</h2>
			<div className="text-gray-500 text-sm">
				{Content["addNewIndividualEmail.description"]}
			</div>
			<form
				ref={formRef}
				className="flex flex-col pt-4 lg:pt-0 lg:flex-row items-start justify-start gap-x-6 xl:gap-x-8 space-y-4 lg:space-y-0 mt-4"
				onSubmit={handleSubmit}
			>
				<div className="space-y-2 max-w-96 w-full">
					<Label htmlFor="email" className="font-semibold">
						{Content["addNewIndividualEmail.form.email"]}
					</Label>
					<Input
						ref={emailInputRef}
						id="email"
						name="email"
						type="email"
						onChange={clearErrors}
						placeholder={Content["addNewIndividualEmail.form.emailPlaceholder"]}
						required
					/>
				</div>
				<div className="self-start">
					<Button
						className={`lg:mt-8 ${isEmailAdded ? "bg-green-500 hover:bg-green-500" : ""}`}
						type="submit"
					>
						<Plus className="h-4 w-4" />
						{isEmailAdded
							? Content["addNewIndividualEmail.form.button.saved"]
							: Content["addNewIndividualEmail.form.button.save"]}
					</Button>
				</div>
			</form>
			{error && (
				<div
					className="text-berlin-rot mt-4 text-sm"
					dangerouslySetInnerHTML={{ __html: error }}
				/>
			)}
		</div>
	);
};
