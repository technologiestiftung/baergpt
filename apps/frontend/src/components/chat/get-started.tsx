import React from "react";
import { AddToChatIcon } from "../primitives/icons/add-to-chat-icon.tsx";
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
								? Content["chat.getStarted.li1"]
								: Content["chat.getStarted.li1"]}
						</li>
						<li>
							{isAddressedFormal
								? Content["chat.getStarted.li2"]
								: Content["chat.getStarted.li2"]}
						</li>
						<li>
							<div className="flex items-center">
								<p>{Content["chat.getStarted.li3.p1"]}</p>
								<div className="ml-1 mr-0.5 mt-1 size-[18px]">
									<AddToChatIcon variant="plus-light" />
								</div>
								<p>{Content["chat.getStarted.li3.p2"]}</p>
							</div>
						</li>
					</ul>
				</div>
				<div>
					<h2 className="text-base leading-6 font-semibold">
						{Content["chat.getStarted.h2"]}
					</h2>
					<ul className="flex flex-col list-disc ml-4">
						<li>
							{isAddressedFormal
								? Content["chat.getStarted.li4.formal"]
								: Content["chat.getStarted.li4.informal"]}
						</li>
						<li>{Content["chat.getStarted.li5"]}</li>
						<li>
							{isAddressedFormal
								? Content["chat.getStarted.li6.formal"]
								: Content["chat.getStarted.li6.informal"]}
						</li>
						<li>
							<span>
								{isAddressedFormal
									? Content["chat.getStarted.li7.formal"]
									: Content["chat.getStarted.li7.informal"]}
							</span>{" "}
							<a
								href={Content["chat.getStarted.h3.4.link"]}
								target="_blank"
								rel="noopener noreferrer"
								aria-label={Content["chat.getStarted.h3.4.link.ariaLabel"]}
								className="underline"
							>
								{Content["chat.getStarted.h3.4.linkText"]}
							</a>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};
