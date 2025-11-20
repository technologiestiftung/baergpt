import type React from "react";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import Content from "../../content.ts";
import { TableOfContents } from "../../components/privacy-policy/table-of-contents.tsx";
import { ListItem } from "../../components/privacy-policy/list-item.tsx";
import { ContactInfo } from "../../components/privacy-policy/contact-info.tsx";
import {
	section2ContactItemsB,
	section3ListItems,
	section4ListItems,
	section5ListItems,
	section6ListItems,
	section8ListItems,
} from "./content.ts";

export const PrivacyPolicyPage: React.FC = () => {
	const tableOfContentsItems = [
		Content["privacyPolicyPage.section1.title"],
		Content["privacyPolicyPage.section2.title"],
		Content["privacyPolicyPage.section3.title"],
		Content["privacyPolicyPage.section4.title"],
		Content["privacyPolicyPage.section5.title"],
		Content["privacyPolicyPage.section6.title"],
		Content["privacyPolicyPage.section7.title"],
		Content["privacyPolicyPage.section8.title"],
		Content["privacyPolicyPage.section9.title"],
		Content["privacyPolicyPage.section10.title"],
	];
	// Section Content
	const sections = [
		{
			id: "section-1",
			number: 1,
			title: Content["privacyPolicyPage.section1.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["privacyPolicyPage.section1.p1"]}</p>
					<p>{Content["privacyPolicyPage.section1.p2"]}</p>
					<p>{Content["privacyPolicyPage.section1.p3"]}</p>
				</div>
			),
		},
		{
			id: "section-2",
			number: 2,
			title: Content["privacyPolicyPage.section2.title"],
			content: (
				<>
					<div className="flex flex-col gap-3 lg:gap-5">
						<h3 className="text-base leading-6 lg:text-lg lg:leading-7 font-semibold">
							{Content["privacyPolicyPage.section2.b.title"]}
						</h3>
						<ul className="list-disc pl-5">
							{section2ContactItemsB.map((item) => (
								<li key={item.key}>
									<ContactInfo data={item.data} />
								</li>
							))}
						</ul>
					</div>
				</>
			),
		},
		{
			id: "section-3",
			number: 3,
			title: Content["privacyPolicyPage.section3.title"],
			content: (
				<ul className="list-disc pl-5">
					{section3ListItems.map((item) => (
						<ListItem
							key={item.title}
							title={item.title}
							description={item.description}
						/>
					))}
				</ul>
			),
		},
		{
			id: "section-4",
			number: 4,
			title: Content["privacyPolicyPage.section4.title"],
			content: (
				<ul className="list-disc pl-5">
					{section4ListItems.map((item) => (
						<ListItem
							key={item.title}
							title={item.title}
							description={item.description}
						/>
					))}
				</ul>
			),
		},
		{
			id: "section-5",
			number: 5,
			title: Content["privacyPolicyPage.section5.title"],
			content: (
				<ul className="list-disc pl-5">
					{section5ListItems.map((item, index) => (
						<li key={index}>{item.item}</li>
					))}
				</ul>
			),
		},
		{
			id: "section-6",
			number: 6,
			title: Content["privacyPolicyPage.section6.title"],
			content: (
				<ul className="list-disc pl-5">
					{section6ListItems.map((item) => (
						<ListItem
							key={item.title}
							title={item.title}
							description={item.description}
						/>
					))}
				</ul>
			),
		},
		{
			id: "section-7",
			number: 7,
			title: Content["privacyPolicyPage.section7.title"],
			content: <p>{Content["privacyPolicyPage.section7.p1"]}</p>,
		},
		{
			id: "section-8",
			number: 8,
			title: Content["privacyPolicyPage.section8.title"],
			content: (
				<>
					<p>{Content["privacyPolicyPage.section8.p1"]}</p>
					<ul className="list-disc pl-5">
						{section8ListItems.map((item, index) => (
							<li key={index}>{item.item}</li>
						))}
					</ul>
				</>
			),
		},
		{
			id: "section-9",
			number: 9,
			title: Content["privacyPolicyPage.section9.title"],
			content: (
				<div className="flex flex-col gap-1">
					<p>{Content["privacyPolicyPage.section9.p1"]}</p>
					<p>{Content["privacyPolicyPage.section9.p2"]}</p>
				</div>
			),
		},
		{
			id: "section-10",
			number: 10,
			title: Content["privacyPolicyPage.section10.title"],
			content: <p>{Content["privacyPolicyPage.section10.p1"]}</p>,
		},
	];

	return (
		<LandingPageLayout>
			<div className="pb-[60px] px-5 max-w-[934px] mx-auto text-dunkelblau-100">
				<h1 className="text-4xl leading-10 font-semibold lg:text-6xl lg:leading-none py-[60px] lg:py-20">
					{Content["privacyPolicyPage.h1"]}
				</h1>
				<p className="text-base leading-6 lg:text-lg lg:leading-7 mb-4 lg:mb-5">
					{Content["privacyPolicyPage.date"]}
				</p>
				<h2 className="text-2xl leading-8 lg:text-3xl lg:leading-9 font-semibold mb-4 lg:mb-5">
					{Content["privacyPolicyPage.tableOfContents.title"]}
				</h2>
				<div className="flex flex-col gap-[60px] lg:gap-16">
					<TableOfContents items={tableOfContentsItems} />

					<ol className="list-none pl-0 flex flex-col gap-10 lg:gap-[60px]">
						{sections.map((section) => (
							<li
								key={section.id}
								id={section.id}
								className="flex flex-col gap-5 lg:gap-6 scroll-mt-[100px]"
							>
								<h2 className="flex gap-2 text-3xl leading-9 lg:text-4xl lg:leading-10 font-semibold">
									<span>{section.number}.</span>
									<span>{section.title}</span>
								</h2>
								{section.content}
							</li>
						))}
					</ol>
				</div>
			</div>
		</LandingPageLayout>
	);
};
