import Content from "../../../content";
import { useUserStore } from "../../../store/user-store.ts";
import { type FormEvent, useState, useEffect } from "react";
import { SubmitButton } from "../../primitives/buttons/submit-button.tsx";
import { useToastStore } from "../../../store/use-toast-store.ts";

export const ChatSettings = () => {
	const { user, updateAddressedFormal, updatePersonalPrompt } = useUserStore();
	const [personalPrompt, setPersonalPrompt] = useState(
		user?.personal_system_prompt ?? "",
	);

	useEffect(() => {
		setPersonalPrompt(user?.personal_system_prompt ?? "");
	}, [user?.personal_system_prompt]);

	const hasChanges = personalPrompt !== (user?.personal_system_prompt ?? "");

	const isAddressedFormal = user?.is_addressed_formal ?? true;

	const handleCheckboxChange = async () => {
		await updateAddressedFormal(!isAddressedFormal);
	};

	const { addSuccess } = useToastStore();

	const changeSalutationTo = isAddressedFormal
		? Content["profile.chatSettings.informal"]
		: Content["profile.chatSettings.formal"];

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const { error } = await updatePersonalPrompt(personalPrompt);

		if (!error) {
			addSuccess(Content["profile.chatSettings.personalPromptUpdateSuccess"]);
		}
	};

	return (
		<div className="flex flex-col gap-y-4">
			<h3 className="text-base leading-6 font-semibold ">
				{Content["profile.chatSettings.title"]}
			</h3>
			<div className="flex justify-between items-center flex-row gap-5">
				<p className="text-sm leading-6 font-normal">
					{Content["profile.chatSettings.salutation"]}
				</p>
				<label className="inline-flex items-center cursor-pointer relative">
					<input
						type="checkbox"
						className="sr-only peer"
						id="change-salutation-checkbox"
						onChange={handleCheckboxChange}
						checked={!isAddressedFormal}
						aria-label={`${Content["profile.chatSettings.ariaLabel"]} ${changeSalutationTo}`}
					/>
					<div
						id="change-salutation-toggle"
						className="relative w-[42px] h-6 bg-dunkelblau-40 peer-focus-visible:outline-default rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:size-[18px] after:transition-all peer-checked:bg-aktiv-blau-100"
					/>
				</label>
			</div>
			<form
				onSubmit={handleSubmit}
				className="flex justify-between flex-col gap-4"
			>
				<div>
					<label
						htmlFor="personalPrompt"
						className="text-sm leading-6 font-semibold block cursor-pointer"
					>
						{Content["profile.chatSettings.personalPrompt.title"]}
					</label>
					<p
						id="personalPromptSubtitle"
						className="text-sm text-dunkelblau-60 leading-6 font-normal"
					>
						{Content["profile.chatSettings.personalPrompt.subtitle"]}
					</p>
				</div>
				<textarea
					id="personalPrompt"
					className="w-full min-h-[90px] max-h-60 p-2.5 text-sm border border-dunkelblau-200 rounded-3px placeholder:text-sm placeholder:text-schwarz-60 focus-visible:outline-default"
					placeholder={
						Content["profile.chatSettings.personalPrompt.placeholder"]
					}
					value={personalPrompt}
					onChange={(e) => setPersonalPrompt(e.target.value)}
					maxLength={500}
					aria-describedby="personalPromptSubtitle personalPromptCounter"
				/>
				<p id="personalPromptCounter" className="text-xs leading-6 font-normal text-dunkelblau-40">
					{`${personalPrompt.length} / 500 ${Content["profile.chatSettings.personalPrompt.characters"]}`}
				</p>

				<SubmitButton disabled={!hasChanges} className="mt-4 self-end">
					{Content["profile.submitButton"]}
				</SubmitButton>
			</form>
		</div>
	);
};
