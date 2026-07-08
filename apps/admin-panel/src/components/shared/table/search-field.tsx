import { Input } from "@/components/ui/input";

export function SearchField({
	value,
	onChange,
	placeholder,
}: {
	value: string;
	onChange: (val: string) => void;
	placeholder: string;
}) {
	return (
		<Input
			id="table-search-field"
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="max-w-sm placeholder:text-sm"
		/>
	);
}
