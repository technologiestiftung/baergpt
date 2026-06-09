import React, { useMemo, useState } from "react";
import { ShieldCheck, Plus, Search } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { cn } from "../../lib/utils";
import Content from "../../content";

type DomainEntry = {
	id: string;
	domain: string;
	description: string;
	addedAt: string;
	addedBy: string;
	active: boolean;
};

const INITIAL_DOMAINS: DomainEntry[] = [
	{
		id: "1",
		domain: "polizei.berlin.de",
		description: "Polizei Berlin",
		addedAt: "09.06.2026, 17:00",
		addedBy: "admin@berlin.de",
		active: true,
	},
	{
		id: "2",
		domain: "senbjf.berlin.de",
		description: "Senatsverwaltung Bildung",
		addedAt: "09.06.2026, 15:30",
		addedBy: "admin@berlin.de",
		active: true,
	},
	{
		id: "3",
		domain: "lichtenberg.berlin.de",
		description: "Bezirksamt Lichtenberg",
		addedAt: "09.06.2026, 15:00",
		addedBy: "admin@berlin.de",
		active: true,
	},
	{
		id: "4",
		domain: "lfg-b.de",
		description: "Landesamt für Gesundheit",
		addedAt: "09.06.2026, 14:50",
		addedBy: "admin@berlin.de",
		active: true,
	},
	{
		id: "5",
		domain: "charlottenburg-wilmersdorf.de",
		description: "Bezirksamt Ch.-Wilmersdorf",
		addedAt: "09.06.2026, 14:40",
		addedBy: "admin@berlin.de",
		active: true,
	},
	{
		id: "6",
		domain: "test.berlin.de",
		description: "Testumgebung (veraltet)",
		addedAt: "01.05.2026, 10:00",
		addedBy: "admin@berlin.de",
		active: false,
	},
];

type StatusFilter = "all" | "active" | "inactive";

export const DomainManagement: React.FC = () => {
	const [domains, setDomains] = useState<DomainEntry[]>(INITIAL_DOMAINS);
	const [newDomain, setNewDomain] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const totalCount = domains.length;
	const activeCount = domains.filter((d) => d.active).length;
	const inactiveCount = totalCount - activeCount;

	const filteredDomains = useMemo(() => {
		return domains.filter((d) => {
			const matchesSearch =
				d.domain.toLowerCase().includes(search.toLowerCase()) ||
				d.description.toLowerCase().includes(search.toLowerCase());
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" && d.active) ||
				(statusFilter === "inactive" && !d.active);
			return matchesSearch && matchesStatus;
		});
	}, [domains, search, statusFilter]);

	const handleAddDomain = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmed = newDomain.trim();
		if (!trimmed) {
			return;
		}
		const now = new Date();
		const formatted = `${now
			.toLocaleDateString("de-DE")
			.replace(/\./g, ".")}, ${now.toLocaleTimeString("de-DE", {
			hour: "2-digit",
			minute: "2-digit",
		})}`;
		setDomains((prev) => [
			{
				id: crypto.randomUUID(),
				domain: trimmed,
				description: newDescription.trim(),
				addedAt: formatted,
				addedBy: "admin@berlin.de",
				active: true,
			},
			...prev,
		]);
		setNewDomain("");
		setNewDescription("");
	};

	const toggleStatus = (id: string) => {
		setDomains((prev) =>
			prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d)),
		);
	};

	return (
		<div className="w-full max-w-screen-xl p-6">
			<div className="flex items-center gap-2">
				<ShieldCheck className="size-5 text-dunkelblau-200" />
				<h1 className="text-lg font-semibold text-dunkelblau-200">
					{Content["domainManagement.pageTitle"]}
				</h1>
			</div>
			<div className="mt-4 mb-6 border-t border-gray-200" />

			{/* Add domain form */}
			<form
				onSubmit={handleAddDomain}
				className="rounded-lg border border-gray-200 bg-white p-6"
			>
				<h2 className="text-base font-semibold">
					{Content["domainManagement.addForm.title"]}
				</h2>
				<p className="mt-1 text-sm text-gray-500">
					{Content["domainManagement.addForm.description"]}
				</p>
				<div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
					<div className="flex flex-1 flex-col gap-2">
						<Label htmlFor="new-domain" className="font-medium">
							{Content["domainManagement.addForm.domainLabel"]}
						</Label>
						<Input
							id="new-domain"
							value={newDomain}
							onChange={(e) => setNewDomain(e.target.value)}
							placeholder={
								Content["domainManagement.addForm.domainPlaceholder"]
							}
						/>
					</div>
					<div className="flex flex-1 flex-col gap-2">
						<Label htmlFor="new-description" className="font-medium">
							{Content["domainManagement.addForm.descriptionLabel"]}
						</Label>
						<Input
							id="new-description"
							value={newDescription}
							onChange={(e) => setNewDescription(e.target.value)}
							placeholder={
								Content["domainManagement.addForm.descriptionPlaceholder"]
							}
						/>
					</div>
					<Button type="submit">
						<Plus className="size-4" />
						{Content["domainManagement.addForm.submitButton"]}
					</Button>
				</div>
			</form>

			{/* Summary metric cards */}
			<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div className="rounded-lg bg-muted p-4">
					<div className="text-sm text-gray-500">
						{Content["domainManagement.metrics.total"]}
					</div>
					<div className="mt-1 text-2xl font-semibold">{totalCount}</div>
				</div>
				<div className="rounded-lg bg-muted p-4">
					<div className="text-sm text-gray-500">
						{Content["domainManagement.metrics.active"]}
					</div>
					<div className="mt-1 text-2xl font-semibold text-green-600">
						{activeCount}
					</div>
				</div>
				<div className="rounded-lg bg-muted p-4">
					<div className="text-sm text-gray-500">
						{Content["domainManagement.metrics.inactive"]}
					</div>
					<div className="mt-1 text-2xl font-semibold text-gray-400">
						{inactiveCount}
					</div>
				</div>
			</div>

			{/* Search and filter bar */}
			<div className="mt-3 flex flex-col gap-3 sm:flex-row">
				<div className="relative max-w-sm flex-1">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={Content["domainManagement.search.placeholder"]}
						className="pl-9"
					/>
				</div>
				<Select
					value={statusFilter}
					onValueChange={(value) => setStatusFilter(value as StatusFilter)}
				>
					<SelectTrigger className="w-full sm:w-48">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">
							{Content["domainManagement.filter.all"]}
						</SelectItem>
						<SelectItem value="active">
							{Content["domainManagement.filter.active"]}
						</SelectItem>
						<SelectItem value="inactive">
							{Content["domainManagement.filter.inactive"]}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Domain table */}
			<div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted hover:bg-muted">
							<TableHead>
								{Content["domainManagement.table.head.domain"]}
							</TableHead>
							<TableHead>
								{Content["domainManagement.table.head.description"]}
							</TableHead>
							<TableHead>
								{Content["domainManagement.table.head.addedAt"]}
							</TableHead>
							<TableHead>
								{Content["domainManagement.table.head.addedBy"]}
							</TableHead>
							<TableHead>
								{Content["domainManagement.table.head.status"]}
							</TableHead>
							<TableHead className="text-right">
								{Content["domainManagement.table.head.action"]}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredDomains.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="text-center text-sm text-gray-500"
								>
									{Content["domainManagement.table.noResults"]}
								</TableCell>
							</TableRow>
						) : (
							filteredDomains.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell
										className={cn(
											"font-mono text-sm",
											!entry.active && "text-gray-400 line-through",
										)}
									>
										{entry.domain}
									</TableCell>
									<TableCell className="text-sm text-gray-500">
										{entry.description}
									</TableCell>
									<TableCell className="text-sm text-gray-500">
										{entry.addedAt}
									</TableCell>
									<TableCell className="text-sm text-gray-500">
										{entry.addedBy}
									</TableCell>
									<TableCell>
										{entry.active ? (
											<Badge className="border-transparent bg-green-100 text-green-700 hover:bg-green-100">
												{Content["domainManagement.status.active"]}
											</Badge>
										) : (
											<Badge className="border-transparent bg-gray-100 text-gray-500 hover:bg-gray-100">
												{Content["domainManagement.status.inactive"]}
											</Badge>
										)}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="outline"
											size="sm"
											onClick={() => toggleStatus(entry.id)}
										>
											{entry.active
												? Content["domainManagement.action.deactivate"]
												: Content["domainManagement.action.activate"]}
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
};
