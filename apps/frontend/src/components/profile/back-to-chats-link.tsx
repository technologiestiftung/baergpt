import { Link } from "react-router-dom";
import Content from "../../content.ts";

export function BackToChatsLink() {
	return (
		<Link
			to="/"
			className="flex gap-2 p-2.5 w-fit rounded-[3px] hover:bg-dunkelblau-100 hover:text-white focus-visible:outline-default group cursor-pointer"
		>
			<img
				src="/icons/arrow-back-dark-icon.svg"
				width={16}
				height={16}
				alt=""
				className="group-hover:hidden"
			/>
			<img
				src="/icons/arrow-back-light-icon.svg"
				width={16}
				height={16}
				alt=""
				className="hidden group-hover:block"
			/>
			<span className="text-base leading-6 font-normal">
				{Content["profile.backToChats"]}
			</span>
		</Link>
	);
}
