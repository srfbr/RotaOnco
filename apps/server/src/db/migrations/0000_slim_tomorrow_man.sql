CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp,
	`refresh_token_expires_at` timestamp,
	`scope` text,
	`password` text,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL,
	`image` text,
	`created_at` timestamp NOT NULL,
	`updated_at` timestamp NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp,
	`updated_at` timestamp,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`kind` varchar(64) NOT NULL,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('open','acknowledged','closed') NOT NULL DEFAULT 'open',
	`details` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`resolved_at` datetime(3),
	`resolved_by` bigint,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointment_reminders` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`appointment_id` bigint NOT NULL,
	`channel` enum('whatsapp','sms') NOT NULL,
	`scheduled_for` datetime(3) NOT NULL,
	`sent_at` datetime(3),
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`error` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `appointment_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_reminders_unique_idx` UNIQUE(`appointment_id`,`channel`,`scheduled_for`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`professional_id` bigint NOT NULL,
	`starts_at` datetime(3) NOT NULL,
	`type` enum('triage','treatment','return') NOT NULL,
	`status` enum('scheduled','confirmed','completed','no_show','canceled') NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint,
	`action` varchar(128) NOT NULL,
	`entity` varchar(128) NOT NULL,
	`entity_id` bigint,
	`details` json,
	`ip_address` varchar(45),
	`user_agent` varchar(255),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`channel` enum('whatsapp','sms') NOT NULL,
	`body` text NOT NULL,
	`media_url` varchar(255),
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`scheduled_at` datetime(3),
	`sent_at` datetime(3),
	`error` text,
	`appointment_id` bigint,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`professional_id` bigint NOT NULL,
	`kind` varchar(191) NOT NULL,
	`intensity` tinyint NOT NULL,
	`source` enum('patient','professional') NOT NULL,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `occurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_contacts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`name` varchar(191) NOT NULL,
	`relation` varchar(64),
	`phone` varchar(32) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `patient_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patient_status_history` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`patient_id` bigint NOT NULL,
	`stage` enum('pre_triage','in_treatment','post_treatment') NOT NULL,
	`status` enum('active','inactive','at_risk') NOT NULL,
	`reason` varchar(255),
	`recorded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `patient_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`full_name` varchar(191) NOT NULL,
	`cpf` char(11) NOT NULL,
	`birth_date` datetime,
	`phone` varchar(32),
	`emergency_phone` varchar(32),
	`tumor_type` varchar(191),
	`clinical_unit` varchar(191),
	`stage` enum('pre_triage','in_treatment','post_treatment') NOT NULL DEFAULT 'pre_triage',
	`status` enum('active','inactive','at_risk') NOT NULL DEFAULT 'active',
	`audio_material_url` varchar(255),
	`pin_attempts` int NOT NULL DEFAULT 0,
	`pin_blocked_until` datetime(3),
	`pin_hash` char(60) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `patients_id` PRIMARY KEY(`id`),
	CONSTRAINT `patients_cpf_unique` UNIQUE(`cpf`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` varchar(191),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(191) NOT NULL,
	`value` json NOT NULL,
	`description` varchar(255),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_by` bigint,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` bigint NOT NULL,
	`role_id` int NOT NULL,
	`assigned_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `user_roles_pk` PRIMARY KEY(`user_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`external_id` varchar(36) NOT NULL,
	`name` varchar(191) NOT NULL,
	`email` varchar(191) NOT NULL,
	`document_id` varchar(32) NOT NULL,
	`specialty` varchar(191),
	`phone` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_external_id_unique` UNIQUE(`external_id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`),
	CONSTRAINT `users_document_id_unique` UNIQUE(`document_id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_reminders` ADD CONSTRAINT `appointment_reminders_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_professional_id_users_id_fk` FOREIGN KEY (`professional_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occurrences` ADD CONSTRAINT `occurrences_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occurrences` ADD CONSTRAINT `occurrences_professional_id_users_id_fk` FOREIGN KEY (`professional_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_contacts` ADD CONSTRAINT `patient_contacts_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `patient_status_history` ADD CONSTRAINT `patient_status_history_patient_id_patients_id_fk` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settings` ADD CONSTRAINT `settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_external_id_user_id_fk` FOREIGN KEY (`external_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `alerts_patient_status_idx` ON `alerts` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `appointments_patient_time_idx` ON `appointments` (`patient_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_professional_time_idx` ON `appointments` (`professional_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_channel_status_idx` ON `messages` (`channel`,`status`);--> statement-breakpoint
CREATE INDEX `occurrences_patient_idx` ON `occurrences` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `patients_cpf_idx` ON `patients` (`cpf`);--> statement-breakpoint
CREATE INDEX `patients_stage_idx` ON `patients` (`stage`);--> statement-breakpoint
CREATE INDEX `patients_status_idx` ON `patients` (`status`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_document_idx` ON `users` (`document_id`);