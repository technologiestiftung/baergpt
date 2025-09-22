import { Input } from "@/components/ui/input";
import { Content } from "../../content";

export function SearchField({
	value,
	onChange,
}: {
	value: string;
	onChange: (val: string) => void;
}) {
	return (
		<Input
			id="user-search-field"
			placeholder={Content["userTable.searchField.placeholder"]}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="max-w-sm placeholder:text-sm"
		/>
	);
}
