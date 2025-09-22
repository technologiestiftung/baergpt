import React, { useState, useRef, FormEvent } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Send } from "lucide-react";
import { Label } from "../ui/label";
import Content from "../../content";
import { useUserStore } from "@/store/use-user-store";
import { useUserErrorStore } from "@/store/user-error-store";

export const InviteNewUserForm: React.FC = () => {
	const [isInviteSent, setIsInviteSent] = useState(false);

	const formRef = useRef<HTMLFormElement>(null);

	const { getUsers, inviteUser } = useUserStore();
	const { error } = useUserErrorStore();
	const [isErrorMessageVisible, setIsErrorMessageVisible] =
		useState<boolean>(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const firstName = event.currentTarget.firstName.value;
		const lastName = event.currentTarget.lastName.value;
		const email = event.currentTarget.email.value;

		await inviteUser(email, firstName, lastName);

		if (error) {
			setIsErrorMessageVisible(true);

			setTimeout(() => {
				setIsErrorMessageVisible(false);
			}, 3000);
			return;
		}

		setIsInviteSent(true);

		// clear form after successful submission
		formRef.current?.reset();

		// timeout for button feedback
		setTimeout(() => {
			setIsInviteSent(false);
		}, 3000);

		await getUsers(new AbortController().signal);
	};

	return (
		<div className="w-fit self-start max-w-screen-xl border border-gray-200 rounded-lg p-4  mb-8">
			<h2 className="text-lg font-semibold">
				{Content["inviteNewUser.title"]}
			</h2>
			<div className="text-gray-500 text-sm">
				{Content["inviteNewUser.description"]}
			</div>
			<form
				ref={formRef}
				className="flex flex-col items-start pt-4 lg:pt-0 lg:flex-row justify-start gap-x-6 xl:gap-x-8 lg:items-end space-y-4"
				onSubmit={handleSubmit}
			>
				<div className="space-y-2">
					<Label htmlFor="firstName" className="font-semibold">
						{Content["inviteNewUser.form.firstName"]}
					</Label>
					<Input
						id="firstName"
						name="firstName"
						placeholder={Content["inviteNewUser.form.firstNamePlaceholder"]}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="lastName" className="font-semibold">
						{Content["inviteNewUser.form.lastName"]}
					</Label>
					<Input
						id="lastName"
						name="lastName"
						placeholder={Content["inviteNewUser.form.lastNamePlaceholder"]}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="email" className="font-semibold">
						{Content["inviteNewUser.form.email"]}
					</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder={Content["inviteNewUser.form.emailPlaceholder"]}
						className="w-56"
						required
					/>
				</div>
				<Button
					className={`self-end ${isInviteSent ? "bg-green-500 hover:bg-green-500" : ""}`}
					type="submit"
				>
					<Send className="h-4 w-4 mr-2" />
					{isInviteSent
						? Content["inviteNewUser.form.button.saved"]
						: Content["inviteNewUser.form.button.save"]}
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
