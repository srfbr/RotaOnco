ALTER TABLE `appointment_reminders`
	ADD COLUMN `recipient` enum('patient','professional') NOT NULL DEFAULT 'patient' AFTER `channel`;

ALTER TABLE `appointment_reminders`
	DROP INDEX `appointment_reminders_unique_idx`;

CREATE UNIQUE INDEX `appointment_reminders_unique_idx`
	ON `appointment_reminders` (`appointment_id`, `channel`, `recipient`, `scheduled_for`);
