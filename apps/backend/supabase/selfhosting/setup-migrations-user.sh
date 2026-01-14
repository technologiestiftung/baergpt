#!/bin/bash
# Minimal setup for restricted migrations user
# Run as root on your Supabase server

set -e

USER="migrations"

echo "Setting up restricted migrations user..."

# 1. Create user
useradd -r -m -s /bin/bash "$USER" 2>/dev/null || echo "User exists"

# 2. Create wrapper script for docker inspect (restricted to IP only)
USER_HOME=$(getent passwd "$USER" | cut -d: -f6)
mkdir -p "$USER_HOME/bin"
tee "$USER_HOME/bin/docker-inspect-db-ip" <<'EOF' >/dev/null
#!/bin/bash
# Wrapper script to safely expose only the database IP address
exec /usr/bin/docker inspect supabase-db --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
EOF
chmod 755 "$USER_HOME/bin/docker-inspect-db-ip"
chown $USER:$USER "$USER_HOME/bin/docker-inspect-db-ip"

# Allow only the wrapper script (no arguments allowed)
tee /etc/sudoers.d/migrations <<EOF >/dev/null
$USER ALL=(root) NOPASSWD: $USER_HOME/bin/docker-inspect-db-ip
EOF
chmod 440 /etc/sudoers.d/migrations

# 3. Configure SSH for tunneling only
if ! grep -q "Match User $USER" /etc/ssh/sshd_config; then
    tee -a /etc/ssh/sshd_config <<EOF >/dev/null

# Restrict migrations user to SSH tunneling only
Match User $USER
    AllowTcpForwarding yes
    PermitTTY no
    X11Forwarding no
    AllowAgentForwarding no
EOF
fi

# 4. Reload SSH
sudo systemctl reload ssh
