#!/bin/bash
# Minimal setup for restricted migrations user
# Run as root on your Supabase server

set -e

USER="migrations"

echo "Setting up restricted migrations user..."

# 1. Create user
useradd -r -m -s /bin/bash "$USER" 2>/dev/null || echo "User exists"

# 2. Allow only docker inspect on supabase-db
tee /etc/sudoers.d/migrations <<EOF >/dev/null
$USER ALL=(root) NOPASSWD: /usr/bin/docker inspect supabase-db*
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
