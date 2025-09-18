import Content from "../../../content";
import { useUserStore } from "../../../store/user-store.ts";

export const ChatSettings = () => {
	const { user, updateAddressedFormal } = useUserStore();

	const isAddressedFormal = user?.is_addressed_formal ?? true;

	const handleCheckboxChange = async () => {
		await updateAddressedFormal(!isAddressedFormal);
	};

	const changeSalutationTo = isAddressedFormal
		? Content["profile.chatSettings.informal"]
		: Content["profile.chatSettings.formal"];

	return (
		<div className="flex flex-col gap-y-2">
			<h3 className="text-base leading-6 font-semibold ">
				{Content["profile.chatSettings.title"]}
			</h3>
			<div className="flex justify-between items-center flex-row gap-5">
				<p className="text-base leading-6 font-normal">
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
		</div>
	);
};
