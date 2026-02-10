import React from "react";
import Content from "../../content.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useUserStore } from "../../store/user-store.ts";

export const GetStarted: React.FC = () => {
	const { session } = useAuthStore();
	const { user } = useUserStore();

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;
	const isAddressedFormal = user?.is_addressed_formal;

	const hasTitle = user?.personal_title || user?.academic_title;
	const titleText = `${user?.personal_title ?? ""} ${user?.academic_title ?? ""}`;
	const fullName = `${first_name} ${last_name}`;

	const formalGreeting = hasTitle
		? `${Content["chat.getStarted.h1"]} ${titleText} ${last_name}`
		: `${Content["chat.getStarted.h1"]} ${fullName}`;
	const informalGreeting = `${Content["chat.getStarted.h1"]} ${first_name}`;

	return (
		<div className="flex flex-col gap-8 w-full h-fit items-center justify-center p-6 bg-hellblau-30 text-dunkelblau-100">
			<div className="flex flex-col gap-4">
				<h1 className="text-2xl leading-8 font-semibold md:text-3xl md:font-bold">
					{isAddressedFormal ? formalGreeting : informalGreeting}
				</h1>
				<p className="text-base leading-6 font-normal">
					{isAddressedFormal
						? Content["chat.getStarted.formal.p1"]
						: Content["chat.getStarted.informal.p1"]}
				</p>
			</div>
			<div className="flex flex-col gap-5">
				<div>
					<ul className="flex flex-col list-disc ml-4">
						<li>
							{isAddressedFormal
								? Content["chat.getStarted.li1.formal"]
								: Content["chat.getStarted.li1.informal"]}
						</li>
						<li>
							<b>
								{isAddressedFormal
									? Content["chat.getStarted.li2.formal.1"]
									: Content["chat.getStarted.li2.informal.1"]}
							</b>
							{isAddressedFormal
								? Content["chat.getStarted.li2.formal.2"]
								: Content["chat.getStarted.li2.informal.2"]}
						</li>
						<li>
							<span>
								{isAddressedFormal
									? Content["chat.getStarted.li3.formal"]
									: Content["chat.getStarted.li3.informal"]}
							</span>{" "}
							<a
								href={Content["chat.getStarted.li3.link.href"]}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={Content["chat.getStarted.li3.link.ariaLabel"]}
								className="underline"
							>
								{Content["chat.getStarted.li3.link.label"]}
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};
