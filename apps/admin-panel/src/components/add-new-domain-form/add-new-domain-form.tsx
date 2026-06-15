import React, { useState, useRef, type FormEvent } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { Label } from "../ui/label";
import Content from "../../content";
import { useUserErrorStore } from "@/store/user-error-store";
import { useDomainStore } from "@/store/use-domain-store";

export const AddNewDomainForm: React.FC = () => {
	const [isDomainAdded, setIsDomainAdded] = useState(false);

	const formRef = useRef<HTMLFormElement>(null);

	const { getAllowedEmailDomains, addAllowedEmailDomain } = useDomainStore();
	const { error } = useUserErrorStore();
	const [isErrorMessageVisible, setIsErrorMessageVisible] =
		useState<boolean>(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const domain = event.currentTarget.domain.value;
		const description = event.currentTarget.description.value;

		await addAllowedEmailDomain(domain, description);

		if (error) {
			setIsErrorMessageVisible(true);

			setTimeout(() => {
				setIsErrorMessageVisible(false);
			}, 3000);
			return;
		}

		setIsDomainAdded(true);

		// clear form after successful submission
		formRef.current?.reset();

		// timeout for button feedback
		setTimeout(() => {
			setIsDomainAdded(false);
		}, 3000);

		// refresh allowed email domains
		await getAllowedEmailDomains(new AbortController().signal);
	};

	return (
		<div className="w-full self-start max-w-screen-xl border border-gray-200 rounded-lg p-4 mb-8">
			<h2 className="text-lg font-semibold">{Content["addNewDomain.title"]}</h2>
			<div className="text-gray-500 text-sm">
				{Content["addNewDomain.description"]}
			</div>
			<form
				ref={formRef}
				className="flex flex-col items-start pt-4 lg:pt-0 lg:flex-row justify-start gap-x-6 xl:gap-x-8 lg:items-end space-y-4"
				onSubmit={handleSubmit}
			>
				<div className="space-y-2 w-full">
					<Label htmlFor="email" className="font-semibold">
						{Content["addNewDomain.form.domain"]}
					</Label>
					<Input
						id="domain"
						name="domain"
						type="text"
						placeholder={Content["addNewDomain.form.domainPlaceholder"]}
						required
					/>
				</div>
				<div className="space-y-2 w-full">
					<Label htmlFor="firstName" className="font-semibold">
						{Content["addNewDomain.form.description"]}
					</Label>
					<Input
						id="description"
						name="description"
						placeholder={Content["addNewDomain.form.descriptionPlaceholder"]}
						required
					/>
				</div>
				<Button
					className={`self-end ${isDomainAdded ? "bg-green-500 hover:bg-green-500" : ""}`}
					type="submit"
				>
					<Plus className="h-4 w-4" />
					{isDomainAdded
						? Content["addNewDomain.form.button.saved"]
						: Content["addNewDomain.form.button.save"]}
				</Button>
			</form>
			{error && isErrorMessageVisible && (
				<div
					className="text-berlin-rot mt-4 text-sm"
					dangerouslySetInnerHTML={{ __html: error }}
				/>
			)}
		</div>
	);
};
