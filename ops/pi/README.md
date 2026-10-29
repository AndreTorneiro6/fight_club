# Raspberry Pi maintenance

Host systemd runs OS package updates daily at 03:00 Europe/Lisbon, then reboots. Missed runs are not replayed during daytime startup. The job waits for Fight Club's deployment lock, captures active container names and restart policies, takes a database backup, preserves existing package configuration files during upgrades, and reboots only after successful package checks.

Install the shell script as `/usr/local/sbin/wbglabs-maintenance`, the Python verifier as `/usr/local/libexec/wbglabs-container-check.py`, and the units under `/etc/systemd/system/`. Enable `wbglabs-maintenance.timer` and `wbglabs-container-check.service`. Run the maintenance service manually for the initial authorized upgrade/reboot.

The startup verifier waits for every captured service to be running/healthy and checks the public Fight Club health endpoint. Its report is `/var/lib/wbglabs-maintenance/last-boot-check.json`; upgrade and reboot logs are in the system journal. Container restart policies and Docker startup must be enabled before installation. The helper does not pull container images, prune volumes or perform a distribution upgrade.

Database archives use the optional `MONGODB_BACKUP_URI` (all shared databases) with fallback to the existing application URI. Credentials remain in the private production environment file, never in this directory.
