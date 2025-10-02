import { type FormEvent, useRef, useState } from "react";
import Content from "../../../content.ts";
import { useAuthStore } from "../../../store/auth-store.ts";
import { TextInput } from "../../primitives/text-inputs/text-input.tsx";
import { Dropdown } from "../../primitives/dropdown/dropdown.tsx";
import { useUserStore } from "../../../store/user-store.ts";
import { SubmitButton } from "../../primitives/buttons/submit-button.tsx";
import { useToastStore } from "../../../store/use-toast-store.ts";

interface PersonalInfoFormProps {
	onFormChange?: (hasChanges: boolean) => void;
}

export function PersonalInfoForm({ onFormChange }: PersonalInfoFormProps) {
	const personalInfoFormRef = useRef<HTMLFormElement | null>(null);
	const { session } = useAuthStore();
	const { updateUser } = useUserStore();
	const { user } = useUserStore();
	const [hasChanges, setHasChanges] = useState(false);
	const [isFormValid, setIsFormValid] = useState(true);
	const { addSuccess } = useToastStore();

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;

	const handleFormChange = (event: FormEvent<HTMLFormElement>) => {
		const form = event.currentTarget;
		const personalTitleValue = form.personalTitle.value;
		const academicTitleValue = form.academicTitle.value;
		const firstNameValue = form.firstName.value;
		const lastNameValue = form.lastName.value;

		const originalPersonalTitle = user?.personal_title || "";
		const originalAcademicTitle = user?.academic_title || "";
		const originalFirstName = first_name || "";
		const originalLastName = last_name || "";

		const hasFormChanges =
			personalTitleValue !== originalPersonalTitle ||
			academicTitleValue !== originalAcademicTitle ||
			firstNameValue !== originalFirstName ||
			lastNameValue !== originalLastName;

		setIsFormValid(form.checkValidity());

		setHasChanges(hasFormChanges);
		onFormChange?.(hasFormChanges);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const personalTitle = event.currentTarget.personalTitle.value;
		const academicTitle = event.currentTarget.academicTitle.value;

		const firstName = event.currentTarget.firstName.value || first_name;
		const lastName = event.currentTarget.lastName.value || last_name;

		await updateUser({
			first_name: firstName,
			last_name: lastName,
			academic_title: academicTitle,
			personal_title: personalTitle,
		});

		addSuccess(Content["profile.profileUpdateSuccess"]);

		setTimeout(() => {
			setHasChanges(false);
		}, 500);
	};

	return (
		<div className="flex flex-col gap-4">
			<h3 className="text-base leading-6 font-semibold">
				{Content["profile.personalInfo"]}
			</h3>
			<form
				className="flex flex-col"
				ref={personalInfoFormRef}
				onSubmit={handleSubmit}
				onChange={handleFormChange}
			>
				<div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
					<label
						htmlFor="personalTitle"
						className="flex flex-col w-full gap-y-1 text-sm md:text-base "
					>
						{Content["profile.personalTitleLabel"]}
						<Dropdown
							id="personalTitle"
							className="w-full"
							defaultOption={user?.personal_title || ""}
							emptyLabel={Content["profile.personalTitle.defaultOption"]}
							options={Content["profile.personalTitle.options"]}
						/>
					</label>
					<label
						htmlFor="academicTitle"
						className="flex flex-col w-full gap-y-1 text-sm md:text-base"
					>
						{Content["profile.academicTitleLabel"]}
						<Dropdown
							id="academicTitle"
							className="w-full"
							defaultOption={user?.academic_title || ""}
							emptyLabel={Content["profile.academicTitle.defaultOption"]}
							options={Content["profile.academicTitle.options"]}
						/>
					</label>
				</div>
				<div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-4 md:mt-6">
					<label
						htmlFor="firstName"
						className="flex flex-col gap-y-1 text-sm md:text-base grow"
					>
						<div className="flex gap-1 items-center">
							{Content["profile.firstNameLabel"]}
							<span>{Content["profile.requiredField"]}</span>
						</div>
						<TextInput id="firstName" defaultValue={first_name} />
					</label>

					<label
						htmlFor="lastName"
						className="flex flex-col gap-y-1 text-sm md:text-base grow"
					>
						<div className="flex gap-1 items-center">
							{Content["profile.lastNameLabel"]}
							<span>{Content["profile.requiredField"]}</span>
						</div>
						<TextInput id="lastName" defaultValue={last_name} />
					</label>
				</div>
				<SubmitButton
					disabled={!hasChanges || !isFormValid}
					className="mt-4 self-end"
				>
					{Content["profile.submitButton"]}
				</SubmitButton>
			</form>
		</div>
	);
}
