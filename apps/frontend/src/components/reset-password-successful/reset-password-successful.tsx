import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import Content from "../../content.ts";

export function ResetPasswordSuccessful() {
	return (
		<div className="flex w-full min-h-[95svh] items-center justify-center bg-hellblau-100 px-5">
			<div className="flex flex-col border border-black py-10 px-12 rounded-3px bg-white">
				<h1 className="text-xl md:text-4xl font-bold">
					{Content["resetPasswordSuccessful.h1"]}
				</h1>
				<h2 className="text-xl leading-7 md:text-4xl md:leading-10">
					{Content["resetPasswordSuccessful.h2"]}
				</h2>

				<a
					href={"/"}
					className={`
                            flex gap-x-2 text-lg mt-8 items-center self-end
                            w-fit py-2 px-3 text-white rounded-3px 
                            bg-dunkelblau-100 disabled:bg-schwarz-40
                            hover:bg-dunkelblau-80 focus-visible:outline-default
                        `}
				>
					{Content["resetPasswordSuccessful.buttonLink"]}
					<ArrowWhiteRightIcon />
				</a>
			</div>
		</div>
	);
}
