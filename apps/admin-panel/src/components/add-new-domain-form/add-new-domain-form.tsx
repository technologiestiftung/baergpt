import React, { useState, useRef, type FormEvent } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { Label } from "../ui/label";
import Content from "../../content";
import { useUserErrorStore } from "@/store/user-error-store";
import { useDomainStore } from "@/store/use-domain-store";
import { validateDomainInput } from "./domain-validation";

function getDomainValidationMessage(
	validationError: ReturnType<typeof validateDomainInput>,
): string | null {
	if (validationError === "wildcard") {
		return Content["addNewDomain.form.validation.wildcardNotAllowed"];
	}

	if (validationError === "invalidFormat") {
		return Content["addNewDomain.form.validation.invalidFormat"];
	}

	return null;
}

export const AddNewDomainForm: React.FC = () => {
	const [isDomainAdded, setIsDomainAdded] = useState(false);

	const formRef = useRef<HTMLFormElement>(null);
	const domainInputRef = useRef<HTMLInputElement>(null);

	const { getAllowedEmailDomains, addAllowedEmailDomain } = useDomainStore();
	const { error } = useUserErrorStore();
	const [isErrorMessageVisible, setIsErrorMessageVisible] =
		useState<boolean>(false);
	const [domainError, setDomainError] = useState<string | null>(null);

	const applyDomainValidation = (value: string) => {
		const input = domainInputRef.current;
		if (!input) {
			return;
		}

		const validationError = validateDomainInput(value);
		const message = getDomainValidationMessage(validationError);

		if (message) {
			input.setCustomValidity(message);
			setDomainError(message);
		} else {
			input.setCustomValidity("");
			setDomainError(null);
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const domain = event.currentTarget.domain.value.trim();
		const description = event.currentTarget.description.value;

		applyDomainValidation(domain);
		if (!domainInputRef.current?.checkValidity()) {
			domainInputRef.current?.reportValidity();
			return;
		}

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
		setDomainError(null);

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
				className="flex flex-col pt-4 lg:pt-0 lg:flex-row items-start justify-start gap-x-6 xl:gap-x-8 space-y-4 lg:space-y-0 mt-4"
				onSubmit={handleSubmit}
			>
				<div className="space-y-2 w-full">
					<Label htmlFor="domain" className="font-semibold">
						{Content["addNewDomain.form.domain"]}
					</Label>
					<Input
						ref={domainInputRef}
						id="domain"
						name="domain"
						type="text"
						placeholder={Content["addNewDomain.form.domainPlaceholder"]}
						required
						onInput={(event) =>
							applyDomainValidation(event.currentTarget.value)
						}
						onInvalid={() =>
							setDomainError(domainInputRef.current?.validationMessage ?? null)
						}
						aria-invalid={domainError ? true : undefined}
						aria-describedby={domainError ? "domain-error" : undefined}
					/>
					{domainError && (
						<p id="domain-error" className="text-berlin-rot text-sm">
							{domainError}
						</p>
					)}
				</div>
				<div className="space-y-2 w-full">
					<Label htmlFor="description" className="font-semibold">
						{Content["addNewDomain.form.description"]}
					</Label>
					<Input
						id="description"
						name="description"
						placeholder={Content["addNewDomain.form.descriptionPlaceholder"]}
						required
					/>
				</div>
				<div className="self-start">
					<Button
						className={`lg:mt-8 ${isDomainAdded ? "bg-green-500 hover:bg-green-500" : ""}`}
						type="submit"
					>
						<Plus className="h-4 w-4" />
						{isDomainAdded
							? Content["addNewDomain.form.button.saved"]
							: Content["addNewDomain.form.button.save"]}
					</Button>
				</div>
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
