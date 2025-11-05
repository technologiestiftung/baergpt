import Content from "../../content.ts";
import { Accordion } from "../primitives/accordion/accordion.tsx";

const faq = [
	{
		questions: [
			{
				question: Content["landingPage.safety.accordion.question1"],
				answer: (
					<div>
						<p className="mb-3">
							{Content["landingPage.safety.accordion.answer1.p1"]}
						</p>
						<ul className="list-disc ml-6 text-base leading-6 font-normal">
							<li>{Content["landingPage.safety.accordion.answer1.li1"]}</li>
							<li>{Content["landingPage.safety.accordion.answer1.li2"]}</li>
							<li>{Content["landingPage.safety.accordion.answer1.li3"]}</li>
						</ul>
					</div>
				),
			},
			{
				question: Content["landingPage.safety.accordion.question2"],
				answer: Content["landingPage.safety.accordion.answer2.p1"],
			},
			{
				question: Content["landingPage.safety.accordion.question3"],
				answer: Content["landingPage.safety.accordion.answer3.p1"],
			},
		],
	},
];

export function LandingPageSafety() {
	return (
		<div className="flex flex-col py-[60px] sm:py-20 px-5 lg:px-0 text-dunkelblau-100 gap-6 sm:gap-5 lg:gap-12 lg:max-w-[934px] mx-auto">
			<h2 className="max-w-[624px] mx-auto text-2xl text-center leading-8 font-semibold sm:text-3xl sm:leading-9 lg:text-4xl lg:leading-10">
				{Content["landingPage.safety.h2"]}
			</h2>
			{faq.map((section, index) => (
				<div key={index}>
					<div className="flex flex-col gap-2.5">
						{section.questions.map(({ question, answer }, qIndex) => (
							<Accordion key={qIndex} question={question} answer={answer} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}
