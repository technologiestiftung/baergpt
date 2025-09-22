import { User } from "../../../common";

export function getUserStatus(user: User): User["status"] {
	if (!user.is_active || user.deleted_at !== null) {
		return "inactive";
	}

	if (user.invited_at && !user.last_login_at) {
		return "invited";
	}

	if (user.is_admin) {
		return "admin";
	}

	return "active";
}
