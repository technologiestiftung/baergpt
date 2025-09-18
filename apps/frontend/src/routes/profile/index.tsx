import Content from "../../content.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { AppLayout } from "../../layouts/app-layout.tsx";
import { PersonalInfoForm } from "../../components/profile/edit-profile-forms/personal-info-form.tsx";
import { BackToChatsLink } from "../../components/profile/back-to-chats-link.tsx";
import { ChangeEmailForm } from "../../components/profile/edit-profile-forms/change-email-form.tsx";
import { DeleteAccount } from "../../components/profile/delete-account/delete-account.tsx";
import { useSessionRedirect } from "../../hooks/use-session-redirect.tsx";
import { ChatSettings } from "../../components/profile/chat-settings/chat-settings.tsx";
import { ChangePasswordForm } from "../../components/profile/edit-profile-forms/change-password-form.tsx";

export function ProfilePage() {
	const { session } = useAuthStore();
	useSessionRedirect();

	if (!session) {
		return null;
	}
	const { first_name, last_name } = session.user.user_metadata;

	const getGreeting = () => {
		const hours = new Date().getHours();
		const isMorning = hours >= 6 && hours < 11;
		const isAfternoon = hours >= 11 && hours <= 18;
		const isEvening = hours > 18 && hours <= 23;

		if (isMorning) {
			return Content["profile.h1.morning"];
		}
		if (isAfternoon) {
			return Content["profile.h1.afternoon"];
		}
		if (isEvening) {
			return Content["profile.h1.evening"];
		}
		return Content["profile.h1.default"];
	};

	return (
		<AppLayout>
			<div className="flex flex-col w-full items-center bg-white md:bg-hellblau-30 px-5 py-[30px] md:px-5 md:py-20">
				<div className="w-full max-w-[720px] mb-2">
					<BackToChatsLink />
				</div>
				<div className="flex flex-col gap-8 md:gap-11 border max-w-[720px] w-full border-black p-5 md:py-8 md:px-10 rounded-3px bg-white">
					<div className="flex gap-5 items-center">
						<div className="hidden md:flex items-center justify-center rounded-full size-[72px] p-1.5 bg-hellblau-60">
							<span className="text-center p-1 text-3xl font-bold uppercase text-dunkelblau-100">
								{first_name?.[0]?.toUpperCase() ?? ""}
								{last_name?.[0]?.toUpperCase() ?? ""}
							</span>
						</div>
						<div>
							<h1 className="text-xl leading-7 font-semibold md:text-3xl md:leading-9 md:font-bold">
								{getGreeting()} {first_name} {last_name}
							</h1>
							<h2 className="text-base leading-6 md:text-lg md:leading-7 font-normal">
								{Content["profile.h2"]}
							</h2>
						</div>
					</div>

					<PersonalInfoForm />
					<ChangeEmailForm />
					<ChangePasswordForm />
					<ChatSettings />
					<DeleteAccount />
				</div>
			</div>
		</AppLayout>
	);
}
