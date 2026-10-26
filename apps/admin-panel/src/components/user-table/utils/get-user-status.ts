import type { User } from "../../../common";

export function getUserStatus(user: User): User["status"] {
	if (user.is_registration_pending) {
		return "pending";
	}

	if (user.banned_until) {
		return "banned";
	}

	if (user.is_admin) {
		return "admin";
	}

	return "active";
}
