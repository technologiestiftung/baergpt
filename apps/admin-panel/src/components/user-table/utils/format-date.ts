export function formatDate(dateString?: string | null): string | null {
	if (!dateString) {
		return null;
	}
	const date = new Date(dateString);

	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();

	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${day}.${month}.${year}, ${hours}:${minutes}`;
}
