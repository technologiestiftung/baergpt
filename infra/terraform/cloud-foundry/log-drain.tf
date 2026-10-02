# Per-space syslog drain pointing at that space's log bridge (infra/cf-log-bridge).
# Holds nothing but a URL; CF forwards a bound app's logs there. Binding is declared in
# each app's manifest so a redeployed app re-binds itself, see apps/backend/manifest.yml.
resource "cloudfoundry_service_instance" "log_drain" {
  for_each = cloudfoundry_space.this

  name  = "stackit-drain"
  type  = "user-provided"
  space = each.value.id

  # Credentials sit in the URL's userinfo because that is CF's only way to authenticate
  # to a drain. They must match DRAIN_USERNAME/DRAIN_PASSWORD on the bridge app, or
  # delivery 401s with no error surfaced anywhere.
  #
  # drain-type=all adds container metrics alongside logs. The route is derived rather
  # than looked up: Cloud Controller stores this string without resolving it, so the
  # bridge need not exist yet.
  #
  # Host is <app-name>.<apps_domain> and a route belongs to one space, so the app name
  # carries the space. The deploy workflow builds it the same way.
  syslog_drain_url = format(
    "https://%s:%s@%s-%s.%s/?drain-type=all",
    var.drain_credentials[each.key].username,
    var.drain_credentials[each.key].password,
    var.log_bridge_app_name,
    each.key,
    var.apps_domain,
  )

  depends_on = [cloudfoundry_space_role.manager]
}
