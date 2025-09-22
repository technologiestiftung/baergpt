import React, { useState, useRef, FormEvent, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, RotateCw } from "lucide-react";
import { useUserStore } from "@/store/use-user-store";
import Content from "../../../content";
import { EmailInputField } from "./email-input-field";
import { SelectField } from "./select-field";
import { useUserErrorStore } from "@/store/user-error-store";

interface FormData {
	academicTitle: string;
	firstName: string;
	lastName: string;
	email: string;
	isAdmin: boolean;
	personalTitle: string;
}

export const UserEditForm: React.FC = () => {
	const {
		selectedUser,
		users,
		isUserProfileUpdated,
		isEmailUpdateSuccessful,
		getUsers,
		updateUserProfile,
		updateUserAdminStatus,
		inviteUser,
	} = useUserStore();

	const initialFormData: FormData = useMemo(
		() => ({
			academicTitle: selectedUser?.academic_title || "",
			firstName: selectedUser?.first_name || "",
			lastName: selectedUser?.last_name || "",
			email: selectedUser?.email || "",
			isAdmin: selectedUser?.is_admin || false,
			personalTitle: selectedUser?.personal_title || "",
		}),
		[selectedUser],
	);

	const [formData, setFormData] = useState<FormData>(initialFormData);
	const [originalEmail, setOriginalEmail] = useState(selectedUser?.email || "");
	const [emailError, setEmailError] = useState("");
	const [isInviteSent, setIsInviteSent] = useState(false);

	const { error } = useUserErrorStore();
	const [isErrorMessageVisible, setIsErrorMessageVisible] =
		useState<boolean>(false);

	const formRef = useRef<HTMLFormElement>(null);

	// Check if any field has changed
	const hasUserDataChanged = useMemo(() => {
		if (!selectedUser) {
			return false;
		}

		return (
			formData.academicTitle !== (selectedUser.academic_title || "") ||
			formData.firstName !== (selectedUser.first_name || "") ||
			formData.lastName !== (selectedUser.last_name || "") ||
			formData.email !== originalEmail ||
			formData.isAdmin !== selectedUser.is_admin ||
			formData.personalTitle !== (selectedUser?.personal_title || "")
		);
	}, [formData, selectedUser, originalEmail]);

	// Generic handler for text input changes
	const handleInputChange =
		(field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			// Trim whitespace from the input value
			const processedValue = value.trim();

			setFormData((prev) => ({
				...prev,
				[field]: processedValue,
			}));
			setEmailError("");
		};

	const handleAdminChange = (checked: boolean) => {
		setFormData((prev) => ({
			...prev,
			isAdmin: checked,
		}));
	};

	const handlePersonalTitleChange = (value: string) => {
		setFormData((prev) => ({
			...prev,
			personalTitle: value === "default" ? "" : value,
		}));
	};

	const handleAcademicTitleChange = (value: string) => {
		setFormData((prev) => ({
			...prev,
			academicTitle: value === "default" ? "" : value,
		}));
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!selectedUser) {
			return;
		}

		const newEmail = formData.email;

		// Check if email is already in use by another user
		const isEmailAlreadyInUse = users.some(
			(user) =>
				user.email === newEmail && user.user_id !== selectedUser.user_id,
		);

		if (isEmailAlreadyInUse) {
			setEmailError(Content["userEditModal.form.emailAlreadyInUseError"]);
			return;
		}

		if (
			formData.academicTitle !== (selectedUser.academic_title || "") ||
			formData.firstName !== selectedUser.first_name ||
			formData.lastName !== selectedUser.last_name ||
			newEmail !== originalEmail ||
			formData.personalTitle !== (selectedUser.personal_title || "")
		) {
			await updateUserProfile(selectedUser.user_id, {
				academicTitle: formData.academicTitle,
				firstName: formData.firstName,
				lastName: formData.lastName,
				email: newEmail,
				personalTitle: formData.personalTitle,
			});

			// If the email was changed successfully, update the reference so the next
			// change detection cycle compares against the new saved value.
			if (newEmail !== originalEmail) {
				setOriginalEmail(newEmail);
			}
		}

		if (formData.isAdmin !== selectedUser.is_admin) {
			await updateUserAdminStatus(selectedUser.user_id, formData.isAdmin);
		}

		//refresh user list after update
		await getUsers(new AbortController().signal);
	};

	const handleResendInvite = async () => {
		const email = selectedUser?.email;

		if (!email) {
			console.error("No email provided for user invite");
			return;
		}

		// since user already exists, this will only resend the invite
		await inviteUser(email);

		if (error) {
			setIsErrorMessageVisible(true);

			setTimeout(() => {
				setIsErrorMessageVisible(false);
			}, 3000);
			return;
		}

		setIsInviteSent(true);

		setTimeout(() => {
			setIsInviteSent(false);
		}, 3000);

		setIsErrorMessageVisible(false);
	};

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>{Content["userEditModal.form.title"]}</CardTitle>
				<CardDescription>
					{Content["userEditModal.form.description"]}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					ref={formRef}
					className="flex flex-col space-y-4"
					onSubmit={handleSubmit}
				>
					<SelectField
						id="academicTitle"
						label={Content["userEditModal.form.titleLabel"]}
						value={formData.academicTitle}
						placeholder={
							Content["userEditModal.form.academicTitle.placeholder"]
						}
						defaultOption={
							Content["userEditModal.form.academicTitle.defaultOption"]
						}
						options={Content["userEditModal.form.academicTitle.options"]}
						onValueChange={handleAcademicTitleChange}
					/>
					<SelectField
						id="personalTitle"
						label={Content["userEditModal.form.personalTitleLabel"]}
						value={formData.personalTitle}
						placeholder={
							Content["userEditModal.form.personalTitle.placeholder"]
						}
						defaultOption={
							Content["userEditModal.form.personalTitle.defaultOption"]
						}
						options={Content["userEditModal.form.personalTitle.options"]}
						onValueChange={handlePersonalTitleChange}
					/>
					<div className="space-y-2">
						<Label htmlFor="firstName">
							{Content["userEditModal.form.firstName"]}
						</Label>
						<Input
							id="firstName"
							value={formData.firstName}
							onChange={handleInputChange("firstName")}
							placeholder={Content["userEditModal.form.firstNamePlaceholder"]}
							required
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="lastName">
							{Content["userEditModal.form.lastName"]}
						</Label>
						<Input
							id="lastName"
							value={formData.lastName}
							onChange={handleInputChange("lastName")}
							placeholder={Content["userEditModal.form.lastNamePlaceholder"]}
							required
						/>
					</div>
					<div className="space-y-2">
						<EmailInputField
							defaultValue={formData.email}
							error={emailError}
							updated={
								isEmailUpdateSuccessful && formData.email !== originalEmail
							}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
								setFormData((prev) => ({
									...prev,
									email: e.target.value.trim(),
								}));
								setEmailError("");
							}}
						/>
					</div>
					<div className="flex items-center space-x-2 py-2">
						<Switch
							id="admin"
							checked={formData.isAdmin}
							onCheckedChange={handleAdminChange}
						/>
						<Label htmlFor="admin">
							{Content["userEditModal.form.isAdmin"]}
						</Label>
					</div>
					{isUserProfileUpdated && (
						<p className="text-green-500">
							{Content["userEditModal.form.updateSuccess"]}
						</p>
					)}
					<div className="flex flex-col sm:flex-row justify-between items-center gap-4">
						<Button
							className={`${isUserProfileUpdated ? "bg-green-500 hover:bg-green-500" : ""}`}
							type="submit"
							disabled={!hasUserDataChanged}
						>
							<Save className="h-4 w-4 mr-2" />
							{isUserProfileUpdated
								? Content["userEditModal.form.button.saved"]
								: Content["userEditModal.form.button.save"]}
						</Button>
						{selectedUser?.status === "invited" && (
							<Button
								className={`w-fit ${isInviteSent ? "bg-green-500 hover:bg-green-500" : ""}`}
								type="button"
								onClick={handleResendInvite}
							>
								{isInviteSent ? (
									Content[
										"userEditModal.userInformationCard.resendInvite.success"
									]
								) : (
									<>
										<RotateCw className="h-4 w-4 mr-2" />
										{Content["userEditModal.userInformationCard.resendInvite"]}
									</>
								)}
							</Button>
						)}
					</div>
				</form>
				{error && isErrorMessageVisible && (
					<div
						className="text-berlin-rot mt-4 text-sm"
						dangerouslySetInnerHTML={{ __html: error }}
					/>
				)}
			</CardContent>
		</Card>
	);
};
