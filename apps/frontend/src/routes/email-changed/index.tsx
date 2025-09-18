import { AppLayout } from "../../layouts/app-layout.tsx";
import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import Content from "../../content.ts";

export function EmailChanged() {
	return (
		<AppLayout>
			<div className="flex w-full min-h-[95svh] items-center justify-center bg-hellblau-100 px-5">
				<div className="flex flex-col border border-black py-10 px-12 rounded-3px bg-white w-[52rem]">
					<h1 className="text-xl leading-7 md:text-4xl md:leading-10 font-normal">
						{Content["emailChanged.title"]}
					</h1>
					<a
						href={"/"}
						className={`
							flex gap-x-2 text-lg mt-8 items-center self-end
							w-fit py-2 px-3 text-white rounded-3px 
							bg-dunkelblau-100 disabled:bg-schwarz-40
							hover:bg-dunkelblau-80 focus-visible:outline-default
						`}
					>
						{Content["emailChanged.buttonLink"]}
						<ArrowWhiteRightIcon />
					</a>
				</div>
			</div>
		</AppLayout>
	);
}
