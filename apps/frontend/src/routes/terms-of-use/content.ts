import Content from "../../content.ts";

export const tableOfContentsItems = [
	{ title: Content["termsOfUsePage.section1.title"] },
	{
		title: Content["termsOfUsePage.section2.title"],
		id: "section-2",
		subsections: [
			{ title: Content["termsOfUsePage.section2.sub1.title"] },
			{ title: Content["termsOfUsePage.section2.sub2.title"] },
			{ title: Content["termsOfUsePage.section2.sub3.title"] },
		],
	},
	{
		title: Content["termsOfUsePage.section3.title"],
		id: "section-3",
		subsections: [
			{ title: Content["termsOfUsePage.section3.sub1.title"] },
			{ title: Content["termsOfUsePage.section3.sub2.title"] },
			{ title: Content["termsOfUsePage.section3.sub3.title"] },
			{ title: Content["termsOfUsePage.section3.sub4.title"] },
		],
	},
	{
		title: Content["termsOfUsePage.section4.title"],
		id: "section-4",
		subsections: [
			{ title: Content["termsOfUsePage.section4.sub1.title"] },
			{ title: Content["termsOfUsePage.section4.sub2.title"] },
			{ title: Content["termsOfUsePage.section4.sub3.title"] },
			{ title: Content["termsOfUsePage.section4.sub4.title"] },
		],
	},
	{
		title: Content["termsOfUsePage.section5.title"],
		id: "section-5",
		subsections: [
			{ title: Content["termsOfUsePage.section5.sub1.title"] },
			{ title: Content["termsOfUsePage.section5.sub2.title"] },
			{ title: Content["termsOfUsePage.section5.sub3.title"] },
		],
	},
];

export const section1ListItems = [
	{
		title: Content["termsOfUsePage.section1.li1.title"],
		description: Content["termsOfUsePage.section1.li1.description"],
	},
	{
		title: Content["termsOfUsePage.section1.li2.title"],
		description: Content["termsOfUsePage.section1.li2.description"],
	},
	{
		title: Content["termsOfUsePage.section1.li3.title"],
		description: Content["termsOfUsePage.section1.li3.description"],
	},
	{
		title: Content["termsOfUsePage.section1.li4.title"],
		description: Content["termsOfUsePage.section1.li4.description"],
	},
	{
		title: Content["termsOfUsePage.section1.li5.title"],
		description: Content["termsOfUsePage.section1.li5.description"],
	},
];

export const section2Sub2ItemA = {
	heading: Content["termsOfUsePage.section2.sub2.a.title"],
	organisation: Content["termsOfUsePage.section2.sub2.a.organisation"],
	role: Content["termsOfUsePage.section2.sub2.a.role"],
	name: Content["termsOfUsePage.section2.sub2.a.name"],
	address: {
		street: Content["termsOfUsePage.section2.sub2.a.address.street"],
		city: Content["termsOfUsePage.section2.sub2.a.address.city"],
	},
	email: Content["termsOfUsePage.section2.sub2.a.email"],
};

export const section2Sub2ItemB = {
	heading: Content["termsOfUsePage.section2.sub2.b.title"],
	organisation: Content["termsOfUsePage.section2.sub2.b.organisation"],
	address: {
		street: Content["termsOfUsePage.section2.sub2.a.address.street"],
		city: Content["termsOfUsePage.section2.sub2.a.address.city"],
	},
	email: Content["termsOfUsePage.section2.sub2.a.email"],
};

export const section3Sub2ListItems = [
	{
		item: Content["termsOfUsePage.section3.sub2.li1"],
	},
	{
		item: Content["termsOfUsePage.section3.sub2.li2"],
	},
	{
		item: Content["termsOfUsePage.section3.sub2.li3"],
	},
	{
		item: Content["termsOfUsePage.section3.sub2.li4"],
	},
];

export const section4Sub2ListItems = [
	{
		heading: Content["termsOfUsePage.section4.sub2.li1.heading"],
		description: Content["termsOfUsePage.section4.sub2.li1.description"],
	},
	{
		heading: Content["termsOfUsePage.section4.sub2.li2.heading"],
		description: Content["termsOfUsePage.section4.sub2.li2.description"],
	},
	{
		heading: Content["termsOfUsePage.section4.sub2.li3.heading"],
		description: Content["termsOfUsePage.section4.sub2.li3.description"],
	},
	{
		heading: Content["termsOfUsePage.section4.sub2.li4.heading"],
		description: Content["termsOfUsePage.section4.sub2.li4.description"],
	},
];
